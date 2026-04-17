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
  { bg: "bg-red-500" },
  { bg: "bg-blue-500" },
  { bg: "bg-yellow-500" },
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

  // null = new question, string = editing existing question id
  const [editingId, setEditingId] = useState<string | null>(null);
  const [quizTitle, setQuizTitle] = useState("");
  const [titleModalOpen, setTitleModalOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [titleModalError, setTitleModalError] = useState("");
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

  const displayQuizTitle = quiz?.title?.trim() || quizTitle.trim() || "Untitled quiz";

  function openTitleModal() {
    setTitleDraft(quiz?.title ?? quizTitle);
    setTitleModalError("");
    setTitleModalOpen(true);
  }

  function closeTitleModal() {
    setTitleModalOpen(false);
    setTitleModalError("");
  }

  async function applyTitleFromModal() {
    const t = titleDraft.trim();
    if (!t) {
      setTitleModalError("Title cannot be empty.");
      return;
    }
    setTitleModalError("");
    if (!quiz) {
      setQuizTitle(t);
      closeTitleModal();
      setStatus("");
      return;
    }
    setLoading(true);
    try {
      const updated = await updateQuiz(quiz.id, { title: t });
      setQuiz(updated);
      setQuizTitle(updated.title);
      closeTitleModal();
      setStatus("");
    } catch (e) {
      setTitleModalError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!titleModalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeTitleModal();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [titleModalOpen]);

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

  async function handleSave() {
    const err = validate();
    if (err) {
      setStatus(err);
      return;
    }

    setLoading(true);
    setStatus("");
    try {
      let activeQuiz = quiz;

      if (!activeQuiz) {
        if (!userId || !quizTitle.trim()) {
          setStatus("Set the quiz title first (use the edit button next to the title).");
          setLoading(false);
          return;
        }
        activeQuiz = await createQuiz(userId, quizTitle.trim(), "");
        setQuiz(activeQuiz);
        setQuizTitle(activeQuiz.title);
        router.replace(`/dashboard/edit?quiz=${activeQuiz.id}`);
      }

      const payload = {
        text: questionText.trim(),
        timeLimit,
        imageFile: questionImage,
        answers: draftAnswers
          .filter((a) => a.text.trim())
          .map((a) => ({ text: a.text.trim(), isCorrect: a.isCorrect })),
      };

      if (editingId) {
        await updateQuestion(editingId, activeQuiz.id, payload);
        setStatus("Question updated!");
      } else {
        await createQuestion(activeQuiz.id, payload);
        setStatus("Question added!");
      }
      await loadQuestions(activeQuiz.id);
      clearEditor();
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveAndExit() {
    const hasUnsavedQuestion = questionText.trim() || draftAnswers.some((a) => a.text.trim());

    if (hasUnsavedQuestion) {
      const err = validate();
      if (err) {
        setStatus(err);
        return;
      }

      setLoading(true);
      setStatus("");
      try {
        let activeQuiz = quiz;

        if (!activeQuiz) {
          if (!userId || !quizTitle.trim()) {
            setStatus("Set the quiz title first (use the edit button next to the title).");
            setLoading(false);
            return;
          }
          activeQuiz = await createQuiz(userId, quizTitle.trim(), "");
        }

        const payload = {
          text: questionText.trim(),
          timeLimit,
          imageFile: questionImage,
          answers: draftAnswers
            .filter((a) => a.text.trim())
            .map((a) => ({ text: a.text.trim(), isCorrect: a.isCorrect })),
        };

        if (editingId) {
          await updateQuestion(editingId, activeQuiz.id, payload);
        } else {
          await createQuestion(activeQuiz.id, payload);
        }
      } catch (e) {
        setStatus((e as Error).message);
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader
        center={
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-bold text-white sm:text-base">
              {displayQuizTitle}
            </span>
            <button
              type="button"
              onClick={openTitleModal}
              aria-label="Edit quiz title"
              className="shrink-0 p-1 text-white transition hover:text-white/80"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"
                />
              </svg>
            </button>
          </div>
        }
        right={<SiteHeaderActionLink href="/dashboard">Exit</SiteHeaderActionLink>}
      />

      <div className="flex flex-1">
        {/* LEFT SIDEBAR */}
        <aside className="flex w-40 flex-col border-r border-cyan-300 bg-[#1a9eab]">
          {questions.length >= 2 && (
            <div className="p-3 pb-0">
              <button
                type="button"
                onClick={openReorder}
                className="w-full rounded-md bg-yellow-400 py-2 text-xs font-bold text-white transition hover:bg-yellow-600"
              >
                Reorder
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3">
            <div className="space-y-1">
              {questions.map((q, i) => (
                <button
                  type="button"
                  key={q.id}
                  onClick={() => selectQuestion(q)}
                  className={clsx(
                    "w-full truncate rounded-md px-3 py-1.5 text-left text-xs transition",
                    editingId === q.id
                      ? "bg-cyan-500 font-semibold text-white"
                      : "bg-white text-zinc-700 hover:bg-cyan-100",
                  )}
                >
                  {i + 1}. {q.text.length > 14 ? q.text.substring(0, 14) + ".." : q.text}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 p-3 pt-0">
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="w-full rounded-md bg-cyan-500 py-2 text-xs font-bold text-white transition hover:bg-cyan-600 disabled:opacity-50"
            >
              {editingId ? "Save" : "Add"}
            </button>
            <button
              type="button"
              onClick={() => void handleSaveAndExit()}
              disabled={loading}
              className="w-full rounded-md bg-orange-500 py-2 text-xs font-bold text-white transition hover:bg-orange-600 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={loading}
              className="w-full rounded-md bg-orange-500 py-2 text-xs font-bold text-white transition hover:bg-orange-600 disabled:opacity-50"
            >
              Publish
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleDeleteQuestion}
                disabled={loading}
                className="w-full rounded-md bg-red-500 py-2 text-xs font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
              >
                Delete
              </button>
            )}
          </div>
        </aside>

        {/* MAIN EDITOR */}
        <main className="flex flex-1 flex-col items-center gap-5 p-6">
          {/* Question text */}
          <input
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="Your question here"
            className="w-full max-w-3xl rounded-md border border-zinc-200 bg-white px-5 py-3 text-center text-sm font-medium outline-none focus:border-orange-400"
          />

          {/* Image upload */}
          <div
            {...getRootProps()}
            className="flex w-full max-w-3xl cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-100 py-12 transition hover:border-orange-400"
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
                <span className="mb-1 text-2xl text-zinc-400">+</span>
                <span className="text-xs font-medium text-zinc-500">
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
              className="w-14 rounded border border-zinc-300 px-2 py-1 text-center text-xs outline-none"
            />
            <span>sec</span>
          </div>

          {/* Answer grid */}
          <div className="grid w-full max-w-3xl grid-cols-2 gap-4">
            {draftAnswers.map((ans, i) => {
              const color = ANSWER_COLORS[i];
              return (
                <div
                  key={i}
                  className={clsx(
                    "flex items-center overflow-hidden rounded-lg border-2",
                    ans.isCorrect ? "border-green-500" : "border-zinc-200",
                  )}
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
                        "flex h-full w-12 shrink-0 items-center justify-center",
                        color.bg,
                      )}
                    >
                      {ans.isCorrect ? (
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
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
                    className="flex-1 bg-white px-4 py-3.5 text-sm outline-none"
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
                        "flex h-full w-12 shrink-0 items-center justify-center",
                        color.bg,
                      )}
                    >
                      {ans.isCorrect ? (
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
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

          {status && (
            <p className={clsx(
              "text-xs font-medium",
              status.includes("!") || status.includes("deleted") ? "text-green-600" : "text-red-500",
            )}>
              {status}
            </p>
          )}
        </main>
      </div>

      {titleModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeTitleModal();
          }}
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quiz-title-dialog-label"
          >
            <h2 id="quiz-title-dialog-label" className="text-sm font-bold text-zinc-900">
              Quiz title
            </h2>
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void applyTitleFromModal();
              }}
              placeholder="Enter a title"
              className="mt-3 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-orange-400"
            />
            {titleModalError && (
              <p className="mt-2 text-xs font-medium text-red-600">{titleModalError}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeTitleModal}
                disabled={loading}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void applyTitleFromModal()}
                disabled={loading}
                className="rounded-md bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

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
