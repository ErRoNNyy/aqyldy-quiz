"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDropzone } from "react-dropzone";
import clsx from "clsx";
import {
  SiteHeader,
  SiteHeaderActionLink,
} from "@/src/components/layout/SiteHeader";
import {
  createQuestion,
  createQuiz,
  createSession,
  deleteQuestion,
  deleteQuiz,
  ensureProfile,
  getAnswersByQuestionIds,
  getCurrentUser,
  getMyQuizzes,
  getProfileMaybe,
  getQuizQuestions,
  reorderQuestions,
  updateQuestion,
  updateQuiz,
  isProfileComplete,
} from "@/src/services/supabase/api";
import { profileSetupUrl } from "@/src/services/supabase/profileRoutes";
import { isSupabaseConfigured } from "@/src/services/supabase/client";
import type { Answer, Question, Quiz } from "@/src/types/models";

interface DraftAnswer {
  text: string;
  isCorrect: boolean;
}

const ANSWER_COLORS = [
  { bg: "bg-red-400" },
  { bg: "bg-blue-500" },
  { bg: "bg-yellow-400" },
  { bg: "bg-green-500" },
];

function emptyAnswers(): DraftAnswer[] {
  return [
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ];
}

export function QuizBuilder() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryQuizId = searchParams.get("quiz");

  const [userId, setUserId] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answersMap, setAnswersMap] = useState<Record<string, Answer[]>>({});
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [quizTitle, setQuizTitle] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [questionImage, setQuestionImage] = useState<File | null>(null);
  const [timeLimit, setTimeLimit] = useState(20);
  const [draftAnswers, setDraftAnswers] = useState<DraftAnswer[]>(emptyAnswers());
  const [reorderOpen, setReorderOpen] = useState(false);
  const [reorderList, setReorderList] = useState<Question[]>([]);

  const onDrop = useCallback((files: File[]) => {
    if (files[0]) setQuestionImage(files[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    maxFiles: 1,
  });

  const loadQuestions = useCallback(async (quizId: string) => {
    const q = await getQuizQuestions(quizId);
    setQuestions(q);
    const ids = q.map((r) => r.id);
    if (ids.length > 0) {
      const a = await getAnswersByQuestionIds(ids);
      const grouped = a.reduce<Record<string, Answer[]>>((acc, r) => {
        (acc[r.question_id] ??= []).push(r);
        return acc;
      }, {});
      setAnswersMap(grouped);
    } else {
      setAnswersMap({});
    }
  }, []);

  useEffect(() => {
    async function init() {
      if (!isSupabaseConfigured) {
        setStatus("Configure Supabase ENV first.");
        return;
      }
      const user = await getCurrentUser();
      if (!user) {
        router.replace("/signin?next=/dashboard/edit");
        return;
      }
      await ensureProfile(user, user.email?.split("@")[0] ?? "user");
      const profile = await getProfileMaybe(user.id);
      if (!isProfileComplete(profile)) {
        const q = searchParams.toString();
        router.replace(profileSetupUrl(`/dashboard/edit${q ? `?${q}` : ""}`));
        return;
      }
      setUserId(user.id);

      if (queryQuizId) {
        const rows = await getMyQuizzes(user.id);
        const found = rows.find((q) => q.id === queryQuizId);
        if (found) {
          setQuiz(found);
          setQuizTitle(found.title);
          await loadQuestions(found.id);
        }
      }
    }
    void init();
  }, [loadQuestions, queryQuizId, router, searchParams]);

  function clearEditor() {
    setEditingId(null);
    setQuestionText("");
    setQuestionImage(null);
    setTimeLimit(20);
    setDraftAnswers(emptyAnswers());
    setStatus("");
  }

  function selectQuestion(q: Question) {
    setEditingId(q.id);
    setQuestionText(q.text);
    setQuestionImage(null);
    setTimeLimit(q.time_limit);
    const qAnswers = answersMap[q.id] ?? [];
    setDraftAnswers(
      [0, 1, 2, 3].map((i) => ({
        text: qAnswers[i]?.text ?? "",
        isCorrect: qAnswers[i]?.is_correct ?? false,
      })),
    );
    setStatus("");
  }

  function validate(): string | null {
    if (!questionText.trim()) return "Question text cannot be empty.";
    const filled = draftAnswers.filter((a) => a.text.trim());
    if (filled.length < 2) return "Fill in at least 2 answer options.";
    if (!filled.some((a) => a.isCorrect))
      return "Mark at least one answer as correct.";
    const texts = filled.map((a) => a.text.trim().toLowerCase());
    const unique = new Set(texts);
    if (unique.size !== texts.length) return "Duplicate answers are not allowed.";
    const existingDuplicate = questions.find(
      (q) => q.id !== editingId && q.text.trim().toLowerCase() === questionText.trim().toLowerCase(),
    );
    if (existingDuplicate) return "A question with this exact text already exists.";
    return null;
  }

  async function handleCreateQuiz() {
    if (!userId || !quizTitle.trim()) {
      setStatus("Please enter a quiz title.");
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      const newQuiz = await createQuiz(userId, quizTitle.trim(), "");
      setQuiz(newQuiz);
      setQuizTitle(newQuiz.title);
      router.replace(`/dashboard/edit?quiz=${newQuiz.id}`);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveQuestion() {
    const err = validate();
    if (err) {
      setStatus(err);
      return;
    }
    if (!quiz) return;

    setLoading(true);
    setStatus("");
    try {
      const payload = {
        text: questionText.trim(),
        timeLimit,
        imageFile: questionImage,
        answers: draftAnswers
          .filter((a) => a.text.trim())
          .map((a) => ({ text: a.text.trim(), isCorrect: a.isCorrect })),
      };

      if (editingId) {
        await updateQuestion(editingId, quiz.id, payload);
        setStatus("Question updated!");
      } else {
        await createQuestion(quiz.id, payload);
        setStatus("Question added!");
      }
      await loadQuestions(quiz.id);
      clearEditor();
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveDraft() {
    if (!quiz) return;
    const t = quizTitle.trim();
    if (t && t !== quiz.title) {
      try {
        await updateQuiz(quiz.id, { title: t });
      } catch {}
    }
    router.push("/dashboard");
  }

  async function handleDeleteQuestion() {
    if (!editingId || !quiz) return;
    setLoading(true);
    try {
      await deleteQuestion(editingId);
      await loadQuestions(quiz.id);
      clearEditor();
      setStatus("Question deleted.");
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteQuiz() {
    if (!quiz) return;
    setLoading(true);
    try {
      await deleteQuiz(quiz.id);
      router.push("/dashboard");
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePublish() {
    if (!quiz || !userId) {
      setStatus("Save at least one question first.");
      return;
    }
    if (questions.length === 0) {
      setStatus("Add at least one question before publishing.");
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      const session = await createSession(quiz.id, userId);
      router.push(`/host?quiz=${quiz.id}&session=${session.id}`);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function openReorder() {
    setReorderList([...questions]);
    setReorderOpen(true);
  }

  function moveQuestion(from: number, to: number) {
    if (to < 0 || to >= reorderList.length) return;
    const copy = [...reorderList];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    setReorderList(copy);
  }

  async function saveReorder() {
    setLoading(true);
    try {
      await reorderQuestions(reorderList.map((q) => q.id));
      setQuestions(reorderList);
      setReorderOpen(false);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Step 1: Quiz title creation (no quiz yet)
  if (!quiz && !queryQuizId) {
    return (
      <div className="flex min-h-screen flex-col bg-[#E0EFF0]">
        <SiteHeader
          right={<SiteHeaderActionLink href="/dashboard">Exit</SiteHeaderActionLink>}
        />
        <div className="flex flex-1">
          {/* LEFT SIDEBAR */}
          <aside className="flex w-60 flex-col bg-[#008F9F] px-2" />

          {/* MAIN CONTENT */}
          <main className="flex flex-1 flex-col items-center justify-center px-6">
            <h2 className="mb-4 text-lg font-bold text-zinc-800">Quiz title</h2>
            <input
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreateQuiz();
              }}
              placeholder="My quiz title"
              className="mb-4 w-full max-w-lg rounded-full bg-white px-6 py-3 text-center text-sm font-medium text-zinc-700 shadow-sm outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-cyan-400"
            />
            <button
              type="button"
              onClick={() => void handleCreateQuiz()}
              disabled={loading}
              className="rounded-md bg-[#1fb6c4] px-8 py-2 text-sm font-bold text-white transition hover:bg-[#179aa6] disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save"}
            </button>
            {status && (
              <p className="mt-4 text-xs font-medium text-red-500">{status}</p>
            )}
          </main>
        </div>
      </div>
    );
  }

  // Step 2: Full editor with sidebar
  return (
    <div className="flex min-h-screen flex-col bg-[#E0EFF0]">
      <SiteHeader
        right={<SiteHeaderActionLink href="/dashboard">Exit</SiteHeaderActionLink>}
      />

      <div className="flex flex-1">
        {/* LEFT SIDEBAR */}
        <aside className="flex w-60 flex-col bg-[#008F9F] px-2">
          {/* Quiz title */}
          <div className="border-white/20 px-3 py-6 flex items-center justify-center text-center">
            <input
              value={quiz?.title ?? quizTitle}
              onChange={(e) => {
                const v = e.target.value;
                setQuizTitle(v);
                if (quiz) setQuiz({ ...quiz, title: v });
              }}
              onBlur={async () => {
                const t = (quiz?.title ?? quizTitle).trim();
                if (!t || !quiz) return;
                try {
                  await updateQuiz(quiz.id, { title: t });
                } catch {}
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              placeholder="Quiz title"
              className="w-full rounded-md bg-white/90 px-3 py-4 text-center text-lg font-semibold text-zinc-700 outline-none placeholder:text-zinc-400"
            />
          </div>

          {/* Question list container */}
          <div className="flex-1 px-3">
            <div className="flex h-full flex-col bg-[#E0EFF0]">
              {questions.length >= 2 && (
                <div className="px-2 pt-2">
                  <button
                    type="button"
                    onClick={openReorder}
                    className="mb-1 w-full rounded-md bg-yellow-400 py-1.5 text-xs font-bold text-white transition hover:bg-yellow-500"
                  >
                    Reorder
                  </button>
                </div>
              )}
              <div className="flex-1 space-y-1 overflow-y-auto">
                {questions.map((q, i) => (
                  <button
                    type="button"
                    key={q.id}
                    onClick={() => selectQuestion(q)}
                    className={clsx(
                      "w-full truncate px-6 py-2 text-left text-md font-semibold transition",
                      editingId === q.id
                        ? "bg-cyan-500 text-white"
                        : "bg-white text-zinc-700 hover:bg-cyan-100",
                    )}
                  >
                    {i + 1}. {q.text.length > 14 ? q.text.substring(0, 14) + ".." : q.text}
                  </button>
                ))}
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => { clearEditor(); }}
                  className="w-full bg-[#16AAB9] py-2 text-xs font-bold text-white transition hover:bg-cyan-600"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
          {/* Sidebar buttons */}
          <div className="space-y-2 px-3 py-7">
            <button
              type="button"
              onClick={() => void handleSaveDraft()}
              disabled={loading}
              className="w-full rounded-md bg-[#FF7C22] py-2 text-md font-bold text-white transition hover:bg-orange-600 disabled:opacity-50"
            >
              Save draft
            </button>
            <button
              type="button"
              onClick={() => void handlePublish()}
              disabled={loading}
              className="w-full rounded-md bg-[#FF7C22] py-2 text-md font-bold text-white transition hover:bg-orange-600 disabled:opacity-50"
            >
              Publish quiz
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteQuiz()}
              disabled={loading}
              className="w-full rounded-md bg-[#FF7C22] py-2 text-md font-bold text-white transition hover:bg-orange-600 disabled:opacity-50"
            >
              Delete quiz
            </button>
          </div>
        </aside>

        {/* MAIN EDITOR */}
        <main className="flex flex-1 flex-col items-center gap-10 p-6">
          {/* Question text */}
          <input
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="Your question here"
            className="w-full max-w-5xl rounded-lg bg-white py-3 text-center text-sm font-medium outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-cyan-400 shadow-md"
          />

          {/* Image upload */}
          <div
            {...getRootProps()}
            className="flex w-full max-w-2xl h-full max-h-84 cursor-pointer flex-col items-center justify-center rounded-lg border border-zinc-300 bg-white py-14 transition hover:border-cyan-400"
          >
            <input {...getInputProps()} />
            {questionImage ? (
              <img
                src={URL.createObjectURL(questionImage)}
                alt="Preview"
                className="max-h-36 rounded-lg"
              />
            ) : (
              <>
                <span className="mb-1 text-2xl text-black">+</span>
                <span className="text-sm font-semibold text-black">
                  {isDragActive ? "Drop image here..." : "Upload image"}
                </span>
              </>
            )}
          </div>

          {/* Time limit */}
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <span>Time:</span>
            <input
              type="number"
              min={5}
              max={120}
              value={timeLimit}
              onChange={(e) => setTimeLimit(Number(e.target.value))}
              className="w-14 rounded border border-zinc-300 py-1 text-center text-xs outline-none"
            />
            <span>sec</span>
          </div>

          {/* Answer grid */}
          <div className="grid w-full max-w-5xl h-full grid-cols-2 gap-4">
            {draftAnswers.map((ans, i) => {
              const color = ANSWER_COLORS[i];
              return (
                <div
                  key={i}
                  className="flex items-center overflow-hidden rounded-lg border border-zinc-200 bg-white"
                >
                  {i % 2 === 0 && (
                    <button
                      onClick={() =>
                        setDraftAnswers((c) =>
                          c.map((a, idx) =>
                            idx === i ? { ...a, isCorrect: !a.isCorrect } : a,
                          ),
                        )
                      }
                      className={clsx(
                        "flex h-full w-15 shrink-0 items-center justify-center",
                        color.bg,
                      )}
                    >
                      {ans.isCorrect ? (
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-white bg-white/30" />
                      )}
                    </button>
                  )}

                  <input
                    value={ans.text}
                    onChange={(e) =>
                      setDraftAnswers((c) =>
                        c.map((a, idx) =>
                          idx === i ? { ...a, text: e.target.value } : a,
                        ),
                      )
                    }
                    placeholder={`Answer ${i + 1}`}
                    className="flex-1 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-zinc-400"
                  />

                  {i % 2 === 1 && (
                    <button
                      onClick={() =>
                        setDraftAnswers((c) =>
                          c.map((a, idx) =>
                            idx === i ? { ...a, isCorrect: !a.isCorrect } : a,
                          ),
                        )
                      }
                      className={clsx(
                        "flex h-full w-15 shrink-0 items-center justify-center",
                        color.bg,
                      )}
                    >
                      {ans.isCorrect ? (
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-white bg-white/30" />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom action buttons */}
          <div className="mt-auto flex w-full max-w-5xl items-center gap-3">
          <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void handleDeleteQuestion()}
                disabled={loading || !editingId}
                className="flex items-center gap-1.5 rounded-lg bg-red-300 px-7 py-2.5 text-md font-bold text-red-700 transition hover:bg-red-200 disabled:opacity-50"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
                Delete
              </button>
            <button
              type="button"
              onClick={() => void handleSaveQuestion()}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-[#008F9F] px-10 py-2.5 text-md font-bold text-white transition hover:bg-red-200 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save"}
            </button>
            {status && (
              <p className={clsx(
                "text-xs font-medium text-center",
                status.includes("!") || status.includes("deleted") ? "text-green-600" : "text-red-500",
              )}>
                {status}
              </p>
            )}
            </div>
          </div>
        </main>
      </div>

      {/* Reorder modal */}
      {reorderOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setReorderOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-bold text-zinc-900">Reorder Questions</h2>

            <div className="max-h-[400px] space-y-2 overflow-y-auto">
              {reorderList.map((q, i) => (
                <div
                  key={q.id}
                  className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2"
                >
                  <span className="w-6 text-center text-sm font-bold text-zinc-500">{i + 1}</span>
                  <span className="flex-1 truncate text-sm font-medium text-zinc-800">
                    {q.text || "Untitled"}
                  </span>
                  <button
                    type="button"
                    onClick={() => moveQuestion(i, i - 1)}
                    disabled={i === 0}
                    className="rounded-md px-2 py-1 text-sm font-bold text-zinc-500 transition hover:bg-zinc-200 disabled:opacity-30"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moveQuestion(i, i + 1)}
                    disabled={i === reorderList.length - 1}
                    className="rounded-md px-2 py-1 text-sm font-bold text-zinc-500 transition hover:bg-zinc-200 disabled:opacity-30"
                  >
                    ▼
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReorderOpen(false)}
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveReorder()}
                disabled={loading}
                className="rounded-md bg-orange-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
