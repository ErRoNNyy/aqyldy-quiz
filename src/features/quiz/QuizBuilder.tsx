"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { Reorder } from "framer-motion";
import clsx from "clsx";
import {
  SiteHeader,
  SiteHeaderActionButton,
  SiteHeaderActionLink,
} from "@/src/components/layout/SiteHeader";
import {
  createQuestion,
  createQuiz,
  deleteQuestion,
  deleteQuiz,
  ensureProfile,
  getAnswersByQuestionIds,
  getCurrentUser,
  getMyQuizzes,
  getProfileMaybe,
  getQuizQuestions,
  publishQuiz,
  reorderQuestions,
  touchQuiz,
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


const truncate = (text: string, max = 38) =>
  text.length > max ? `${text.slice(0, max)}...` : text;

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
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [timeLimit, setTimeLimit] = useState(20);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [draftAnswers, setDraftAnswers] = useState<DraftAnswer[]>(emptyAnswers());
  const [reorderOpen, setReorderOpen] = useState(false);
  const [reorderList, setReorderList] = useState<Question[]>([]);
  const [titleEditing, setTitleEditing] = useState(false);
  const [pendingAction, setPendingAction] = useState<null | "publish" | "exit">(
    null,
  );

  const onDrop = useCallback((files: File[]) => {
    if (files[0]) {
      setQuestionImage(files[0]);
      setExistingImageUrl(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    maxFiles: 1,
    noClick: true,
  });

  const hasImage = Boolean(filePreview || existingImageUrl);

  useEffect(() => {
    if (!questionImage) {
      setFilePreview(null);
      return;
    }
    const url = URL.createObjectURL(questionImage);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [questionImage]);

  useEffect(() => {
    if (!coverImage) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(coverImage);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverImage]);

  const coverSrc = coverPreview ?? quiz?.image_url ?? null;

  const loadQuestions = useCallback(async (quizId: string) => {
    const q = await getQuizQuestions(quizId);
    setQuestions(q);
    const ids = q.map((r) => r.id);
    let grouped: Record<string, Answer[]> = {};
    if (ids.length > 0) {
      const a = await getAnswersByQuestionIds(ids);
      grouped = a.reduce<Record<string, Answer[]>>((acc, r) => {
        (acc[r.question_id] ??= []).push(r);
        return acc;
      }, {});
      setAnswersMap(grouped);
    } else {
      setAnswersMap({});
    }
    return { questions: q, answersMap: grouped };
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
          const loaded = await loadQuestions(found.id);
          if (loaded.questions.length > 0) {
            selectQuestion(loaded.questions[0], loaded.answersMap);
          }
        }
      }
    }
    void init();
  }, [loadQuestions, queryQuizId, router, searchParams]);

  function clearEditor() {
    setEditingId(null);
    setQuestionText("");
    setQuestionImage(null);
    setExistingImageUrl(null);
    setTimeLimit(20);
    setDraftAnswers(emptyAnswers());
    setStatus("");
  }

  function selectQuestion(q: Question, answers?: Record<string, Answer[]>) {
    setEditingId(q.id);
    setQuestionText(q.text);
    setQuestionImage(null);
    setExistingImageUrl(q.image_url);
    setTimeLimit(q.time_limit);
    const qAnswers = (answers ?? answersMap)[q.id] ?? [];
    setDraftAnswers(
      [0, 1, 2, 3].map((i) => ({
        text: qAnswers[i]?.text ?? "",
        isCorrect: qAnswers[i]?.is_correct ?? false,
      })),
    );
    setStatus("");
  }

  function hasUnsavedChanges(): boolean {
    const answersFilled = draftAnswers.some((a) => a.text.trim());

    if (!editingId) {
      // New (unsaved) question: dirty if the user typed/added anything.
      return Boolean(
        questionText.trim() ||
          answersFilled ||
          questionImage ||
          existingImageUrl ||
          timeLimit !== 20,
      );
    }

    const original = questions.find((q) => q.id === editingId);
    if (!original) return false;

    if (questionText.trim() !== original.text.trim()) return true;
    if (timeLimit !== original.time_limit) return true;
    // A newly picked file, or a removed/kept image differing from the saved one.
    if (questionImage) return true;
    if ((existingImageUrl ?? null) !== (original.image_url ?? null)) return true;

    const originalAnswers = answersMap[editingId] ?? [];
    for (let i = 0; i < 4; i++) {
      const draft = draftAnswers[i];
      const orig = originalAnswers[i];
      const draftText = draft?.text.trim() ?? "";
      const origText = orig?.text.trim() ?? "";
      if (draftText !== origText) return true;
      if ((draft?.isCorrect ?? false) !== (orig?.is_correct ?? false)) return true;
    }
    return false;
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
      const newQuiz = await createQuiz(userId, quizTitle.trim(), "", coverImage);
      setQuiz(newQuiz);
      setQuizTitle(newQuiz.title);
      setCoverImage(null);
      router.replace(`/dashboard/edit?quiz=${newQuiz.id}`);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveQuestion(): Promise<boolean> {
    const err = validate();
    if (err) {
      setStatus(err);
      return false;
    }
    if (!quiz) return false;

    setLoading(true);
    setStatus("");
    try {
      const payload = {
        text: questionText.trim(),
        timeLimit,
        imageFile: questionImage,
        existingImageUrl,
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
      return true;
    } catch (e) {
      setStatus((e as Error).message);
      return false;
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

  async function publishNow() {
    if (!quiz) return;
    setLoading(true);
    setStatus("");
    try {
      await publishQuiz(quiz.id);
      router.push("/dashboard");
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function exitNow() {
    router.push("/dashboard");
  }

  async function runPendingAction(action: "publish" | "exit") {
    if (action === "publish") {
      await publishNow();
    } else {
      exitNow();
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
    if (hasUnsavedChanges()) {
      setPendingAction("publish");
      return;
    }
    await publishNow();
  }

  function handleExit() {
    if (hasUnsavedChanges()) {
      setPendingAction("exit");
      return;
    }
    exitNow();
  }

  async function handleSaveAndContinue() {
    const action = pendingAction;
    if (!action) return;
    const saved = await handleSaveQuestion();
    if (!saved) return;
    setPendingAction(null);
    await runPendingAction(action);
  }

  async function handleDiscardAndContinue() {
    const action = pendingAction;
    if (!action) return;
    clearEditor();
    setPendingAction(null);
    await runPendingAction(action);
  }

  async function handleSaveTitle() {
    if (!quiz) return;
    const t = (quiz.title ?? quizTitle).trim();
    if (!t) {
      setStatus("Please enter a quiz title.");
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      const updated = await updateQuiz(quiz.id, {
        title: t,
        imageFile: coverImage,
        imageUrl: quiz.image_url,
      });
      setQuiz(updated);
      setQuizTitle(updated.title);
      setCoverImage(null);
      setTitleEditing(false);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function onCoverPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setCoverImage(file);
    e.target.value = "";
  }

  function removeCover() {
    setCoverImage(null);
    if (quiz) setQuiz({ ...quiz, image_url: null });
  }

  function renderCoverPicker() {
    return (
      <div className="mb-6 flex flex-col items-center gap-3">
        {coverSrc ? (
          <img
            src={coverSrc}
            alt="Quiz cover"
            className="h-28 w-28 rounded-full object-cover shadow-md"
          />
        ) : (
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-zinc-200 text-zinc-400">
            <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          </div>
        )}
        <div className="flex items-center gap-3">
          <label className="cursor-pointer rounded-md bg-[#1fb6c4] px-4 py-1.5 text-xs font-bold text-white transition hover:bg-[#179aa6] hover:scale-[1.02]">
            {coverSrc ? "Change image" : "Add image"}
            <input type="file" accept="image/*" className="hidden" onChange={onCoverPick} />
          </label>
          {coverSrc && (
            <button
              type="button"
              onClick={removeCover}
              className="rounded-md bg-red-100 px-4 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-200 hover:scale-[1.02]"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    );
  }

  function openReorder() {
    if (questions.length < 2) {
      setStatus("Add at least 2 questions to reorder.");
      return;
    }
    setReorderList([...questions]);
    setReorderOpen(true);
  }

  async function saveReorder() {
    setLoading(true);
    try {
      await reorderQuestions(reorderList.map((q) => q.id));
      if (quiz) await touchQuiz(quiz.id);
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
    function handleNoQuizAction() {
      setStatus("First create a quiz title.");
    }

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
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreateQuiz();
                }}
                placeholder="Quiz title"
                className="w-full rounded-md bg-white/90 px-3 py-4 text-center text-sm font-semibold text-zinc-700 outline-none placeholder:text-zinc-400"
              />
            </div>

            {/* Question list container (empty) */}
            <div className="flex-1 px-3">
              <div className="flex h-full flex-col bg-[#E0EFF0]">
                <div className="flex-1 space-y-1 overflow-y-auto" />
                <div>
                  <button
                    type="button"
                    onClick={handleNoQuizAction}
                    className="w-full bg-[#16AAB9] py-2 text-xs font-bold text-white transition hover:bg-cyan-600 hover:scale-[1.02]"
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
                onClick={handleNoQuizAction}
                className="w-full rounded-md bg-[#FF7C22] py-2 text-sm font-bold text-white transition hover:bg-orange-600 hover:scale-[1.02]"
              >
                Save draft
              </button>
              <button
                type="button"
                onClick={handleNoQuizAction}
                className="w-full rounded-md bg-[#FF7C22] py-2 text-sm font-bold text-white transition hover:bg-orange-600 hover:scale-[1.02]"
              >
                Publish quiz
              </button>
              <button
                type="button"
                onClick={handleNoQuizAction}
                className="w-full rounded-md bg-[#FF7C22] py-2 text-sm font-bold text-white transition hover:bg-orange-600 hover:scale-[1.02]"
              >
                Delete quiz
              </button>
            </div>
          </aside>

          {/* MAIN CONTENT */}
          <main className="flex flex-1 flex-col items-center justify-center px-6">
            <h2 className="mb-4 text-lg font-bold text-zinc-800">Quiz title</h2>
            {renderCoverPicker()}
            <input
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreateQuiz();
              }}
              placeholder="My quiz title"
              className="mb-4 w-full max-w-4xl rounded-md bg-white px-6 py-3 text-center text-sm font-medium text-zinc-700 shadow-sm outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-cyan-400"
            />
            <button
              type="button"
              onClick={() => void handleCreateQuiz()}
              disabled={loading}
              className="rounded-md bg-[#1fb6c4] px-8 py-2 text-sm font-bold text-white transition hover:bg-[#179aa6] hover:scale-[1.02] disabled:opacity-50"
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

  // Title edit page (opened from the sidebar title in the editor)
  if (titleEditing && quiz) {
    return (
      <div className="flex min-h-screen flex-col bg-[#E0EFF0]">
        <SiteHeader
          right={
            <SiteHeaderActionButton onClick={() => setTitleEditing(false)}>
              Back
            </SiteHeaderActionButton>
          }
        />
        <main className="flex flex-1 flex-col items-center justify-center px-6">
          <h2 className="mb-4 text-lg font-bold text-zinc-800">Quiz title</h2>
          {renderCoverPicker()}
          <input
            value={quiz.title}
            autoFocus
            onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSaveTitle();
            }}
            placeholder="My quiz title"
            className="mb-4 w-full max-w-4xl rounded-md bg-white px-6 py-3 text-center text-sm font-medium text-zinc-700 shadow-sm outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-cyan-400"
          />
          <button
            type="button"
            onClick={() => void handleSaveTitle()}
            disabled={loading}
            className="rounded-md bg-[#1fb6c4] px-8 py-2 text-sm font-bold text-white transition hover:bg-[#179aa6] hover:scale-[1.02] disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save"}
          </button>
          {status && (
            <p className="mt-4 text-xs font-medium text-red-500">{status}</p>
          )}
        </main>
      </div>
    );
  }

  // Step 2: Full editor with sidebar
  return (
    <div className="flex h-screen flex-col bg-[#E0EFF0]">
      <SiteHeader
        right={
          <SiteHeaderActionButton onClick={handleExit}>
            Exit
          </SiteHeaderActionButton>
        }
      />

      <div className="flex min-h-0 flex-1">
        {/* LEFT SIDEBAR */}
        <aside className="flex min-h-0 w-60 flex-col bg-[#008F9F] px-2">
          {/* Quiz title */}
          <div className="border-white/20 px-3 py-6 flex items-center justify-center text-center">
            <button
              type="button"
              onClick={() => setTitleEditing(true)}
              title={quiz?.title ?? quizTitle}
              className="line-clamp-2 w-full break-all rounded-md bg-white/90 p-4 text-center text-sm font-semibold leading-tight text-zinc-700 outline-none transition hover:bg-white"
            >
              {(quiz?.title ?? quizTitle)
                ? truncate(quiz?.title ?? quizTitle)
                : <span className="text-zinc-400">Quiz title</span>}
            </button>
          </div>

          {/* Question list container */}
          <div className="min-h-0 flex-1 px-3">
            <div className="flex h-full flex-col bg-[#E0EFF0]">
              <div className="flex-1 space-y-1 overflow-y-auto">
                {questions.map((q, i) => (
                  <button
                    type="button"
                    key={q.id}
                    onClick={() => selectQuestion(q)}
                    className={clsx(
                      "w-full truncate px-6 py-2 text-left text-sm font-semibold transition",
                      editingId === q.id
                        ? "bg-cyan-500 text-white"
                        : "bg-white text-zinc-700 hover:bg-cyan-100",
                    )}
                  >
                    {i + 1}. {q.text.length > 14 ? q.text.substring(0, 14) + ".." : q.text}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-[1px]">
                <button
                  type="button"
                  onClick={() => { clearEditor(); }}
                  className="w-full bg-[#16AAB9] py-2 text-sm font-bold text-white transition hover:bg-cyan-600 hover:scale-[1.02]"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={openReorder}
                  className="w-full bg-[#16AAB9] py-2 text-sm font-bold text-white transition hover:bg-cyan-600 hover:scale-[1.02]"
                >
                  Reorder
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
              className="w-full rounded-md bg-[#FF7C22] py-2 text-sm font-bold text-white transition hover:bg-orange-600 hover:scale-[1.02] disabled:opacity-50"
            >
              Save draft
            </button>
            <button
              type="button"
              onClick={() => void handlePublish()}
              disabled={loading}
              className="w-full rounded-md bg-[#FF7C22] py-2 text-sm font-bold text-white transition hover:bg-orange-600 hover:scale-[1.02] disabled:opacity-50"
            >
              Publish quiz
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteQuiz()}
              disabled={loading}
              className="w-full rounded-md bg-[#FF7C22] py-2 text-sm font-bold text-white transition hover:bg-orange-600 hover:scale-[1.02] disabled:opacity-50"
            >
              Delete quiz
            </button>
          </div>
        </aside>

        {/* MAIN EDITOR */}
        <main className="flex min-h-0 flex-1 flex-col items-center gap-10 overflow-y-auto p-6">
          {/* Question text */}
          <input
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="Your question here"
            className="w-full max-w-5xl rounded-lg bg-white py-3 text-center text-sm font-medium outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-cyan-400 shadow-md"
          />

          {/* Image upload */}
          <div
            className={clsx(
              "flex w-full max-w-2xl items-start gap-3",
              hasImage && "justify-center",
            )}
          >
            <div
              {...getRootProps()}
              onClick={hasImage ? undefined : open}
              className={clsx(
                "flex flex-col items-center justify-center overflow-hidden rounded-lg border border-zinc-300 bg-white transition hover:border-cyan-400",
                hasImage
                  ? "w-fit"
                  : "h-full max-h-84 flex-1 cursor-pointer py-14",
              )}
            >
              <input {...getInputProps()} />
              {hasImage ? (
                <img
                  src={filePreview ?? existingImageUrl ?? undefined}
                  alt="Preview"
                  className="block max-h-84 w-auto rounded-lg"
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
            {hasImage && (
              <div className="flex shrink-0 flex-col items-center gap-4">
                <button
                  type="button"
                  onClick={open}
                  className="flex h-6 w-6 items-center justify-center transition hover:scale-[1.1]"
                  aria-label="Change image"
                  title="Change image"
                >
                  <img
                    src="/icons/photo_edit_icons/Edit.png"
                    alt="Change image"
                    className="h-6 w-6 object-contain"
                  />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuestionImage(null);
                    setExistingImageUrl(null);
                  }}
                  className="flex h-5 w-5 items-center justify-center transition hover:scale-[1.1]"
                  aria-label="Delete image"
                  title="Delete image"
                >
                  <img
                    src="/icons/photo_edit_icons/close.png"
                    alt="Delete image"
                    className="h-6 w-6 object-contain"
                  />
                </button>
              </div>
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
                        "flex h-full w-15 shrink-0 items-center justify-center transition hover:opacity-80",
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
                        "flex h-full w-15 shrink-0 items-center justify-center transition hover:opacity-80",
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
                className="flex items-center gap-1.5 rounded-lg bg-red-300 px-7 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-400 hover:scale-[1.02] disabled:opacity-50"
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
              className="flex items-center gap-1.5 rounded-lg bg-[#008F9F] px-10 py-2.5 text-sm font-bold text-white transition hover:bg-[#007080] hover:scale-[1.02] disabled:opacity-50"
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
            <h2 className="mb-1 text-lg font-bold text-zinc-900">Reorder Questions</h2>
            <p className="mb-4 text-xs text-zinc-500">Drag the questions to reorder them.</p>

            <Reorder.Group
              axis="y"
              values={reorderList}
              onReorder={setReorderList}
              className="max-h-[400px] space-y-2 overflow-y-auto"
            >
              {reorderList.map((q, i) => (
                <Reorder.Item
                  key={q.id}
                  value={q}
                  className="flex cursor-grab items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 active:cursor-grabbing"
                  whileDrag={{ scale: 1.03, boxShadow: "0 8px 20px rgba(0,0,0,0.15)" }}
                >
                  <span className="w-6 text-center text-sm font-bold text-zinc-500">{i + 1}</span>
                  <span className="flex-1 truncate text-sm font-medium text-zinc-800">
                    {q.text || "Untitled"}
                  </span>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0 text-zinc-400"
                  >
                    <path d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01" />
                  </svg>
                </Reorder.Item>
              ))}
            </Reorder.Group>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReorderOpen(false)}
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 hover:scale-[1.02]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveReorder()}
                disabled={loading}
                className="rounded-md bg-orange-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-orange-600 hover:scale-[1.02] disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved changes prompt (before publishing or exiting) */}
      {pendingAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setPendingAction(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-lg font-bold text-zinc-900">Unsaved changes</h2>
            <p className="mb-5 text-sm text-zinc-500">
              You have unsaved changes to this question. Do you want to save them
              before {pendingAction === "publish" ? "publishing" : "leaving"}?
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 hover:scale-[1.02]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDiscardAndContinue()}
                disabled={loading}
                className="rounded-md bg-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-300 hover:scale-[1.02] disabled:opacity-50"
              >
                {pendingAction === "publish" ? "Discard & publish" : "Discard & leave"}
              </button>
              <button
                type="button"
                onClick={() => void handleSaveAndContinue()}
                disabled={loading}
                className="rounded-md bg-[#008F9F] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#007080] hover:scale-[1.02] disabled:opacity-50"
              >
                {loading
                  ? "Saving..."
                  : pendingAction === "publish"
                    ? "Save & publish"
                    : "Save & leave"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
