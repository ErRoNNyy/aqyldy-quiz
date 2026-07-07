"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { AuthenticatedLayout } from "@/src/components/layout/AuthenticatedLayout";
import { useAuth } from "@/src/contexts/AuthContext";
import {
  createSession,
  deleteQuiz,
  getMyQuizzes,
  getQuestionCountsForQuizzes,
  publishQuiz,
  removeSubscription,
  subscribeHostSessions,
} from "@/src/services/supabase/api";
import type { Quiz } from "@/src/types/models";

type Filter = "all" | "draft" | "published" | "hosted";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function DashboardPanel() {
  const router = useRouter();
  const { user, username, loading: authLoading } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(false);
  const [publishingQuizId, setPublishingQuizId] = useState<string | null>(null);
  const [hostingQuizId, setHostingQuizId] = useState<string | null>(null);
  const [confirmDeleteQuiz, setConfirmDeleteQuiz] = useState<Quiz | null>(null);
  const [status, setStatus] = useState("");

  const refreshQuizzes = useCallback(async (uid: string) => {
    const rows = await getMyQuizzes(uid);
    setQuizzes(rows);
  }, []);

  const loadQuizzes = useCallback(async (uid: string) => {
    const rows = await getMyQuizzes(uid);
    setQuizzes(rows);
    const ids = rows.map((q) => q.id);
    const counts = await getQuestionCountsForQuizzes(ids);
    setQuestionCounts(counts);
  }, []);

  useEffect(() => {
    async function init() {
      if (!user) return;
      try {
        await loadQuizzes(user.id);
      } catch (error) {
        setStatus((error as Error).message);
      }
    }
    if (!authLoading) void init();
  }, [user, authLoading, loadQuizzes]);

  useEffect(() => {
    if (!user) return;
    const channel = subscribeHostSessions(user.id, () => {
      void refreshQuizzes(user.id);
    });
    const onFocus = () => void refreshQuizzes(user.id);
    window.addEventListener("focus", onFocus);
    return () => {
      removeSubscription(channel);
      window.removeEventListener("focus", onFocus);
    };
  }, [user, refreshQuizzes]);

  type QuizState = "draft" | "published" | "hosted";
  const getQuizState = (quiz: Quiz): QuizState => {
    if (quiz.is_hosted) return "hosted";
    if (quiz.is_published) return "published";
    return "draft";
  };

  const filteredQuizzes = quizzes.filter((quiz) => {
    if (filter === "all") return true;
    return getQuizState(quiz) === filter;
  });

  async function handleDelete(quizId: string) {
    if (!user) return;
    setLoading(true);
    try {
      await deleteQuiz(quizId);
      await loadQuizzes(user.id);
      setConfirmDeleteQuiz(null);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePublish(quizId: string) {
    if (!user) return;
    setPublishingQuizId(quizId);
    setStatus("");
    try {
      await publishQuiz(quizId);
      await loadQuizzes(user.id);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setPublishingQuizId(null);
    }
  }

  async function handleHost(quizId: string) {
    if (!user) return;
    setHostingQuizId(quizId);
    setStatus("");
    try {
      const session = await createSession(quizId, user.id);
      router.push(`/host?session=${session.id}`);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setHostingQuizId(null);
    }
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "draft", label: "Draft" },
    { key: "published", label: "Published" },
    { key: "hosted", label: "Hosted" },
  ];

  return (
    <AuthenticatedLayout username={username}>
      <div className="flex-1 bg-[#E0EFF0] p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex max-w-md flex-1 gap-3">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={clsx(
                "flex-1 rounded-lg px-3 py-1.5 text-center text-sm font-semibold transition sm:px-4",
                filter === f.key
                  ? "bg-[#FFA05F] text-white"
                  : "border border-[#86D5DE] bg-[#D9EDED] text-[#008F9F] hover:bg-white/50",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => router.push("/dashboard/edit")}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#FF7C22] px-10 py-1.5 text-sm font-bold text-white transition hover:bg-orange-600 hover:scale-[1.02]"
        >
          New quiz
        </button>
      </div>

      {status && <p className="mb-4 text-sm font-medium text-red-600">{status}</p>}

      <div className="columns-1 gap-4 pt-5 lg:columns-2">
        {filteredQuizzes.map((quiz) => {
          const count = questionCounts[quiz.id] ?? 0;
          const state = getQuizState(quiz);
          const isDraft = state === "draft";
          const quizStatus =
            state === "hosted"
              ? "HOSTED"
              : state === "published"
                ? "PUBLISHED"
                : "DRAFT";
          const statusClassName =
            state === "hosted"
              ? "text-emerald-600 rounded-full bg-green-200 px-5 py-1 text-xs font-bold"
              : state === "published"
                ? "text-[#0369A1] rounded-full bg-[#DBEEFB] px-5 py-1 text-xs font-bold"
                : "text-[#C46900] rounded-full bg-[#FBE7D0] px-5 py-1 text-xs font-bold";

          return (
            <div
              key={quiz.id}
              className="mb-4 flex break-inside-avoid items-start gap-4 rounded-xl bg-white p-5 shadow-lg"
            >
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-zinc-400">
                {quiz.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={quiz.image_url}
                    alt={quiz.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                  </svg>
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-7">
                  <h3 className="min-w-0 break-all text-md font-bold text-[#008F9F]">{quiz.title}</h3>
                  <span className={clsx("shrink-0 text-sm font-bold", statusClassName)}>
                    {quizStatus}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-black py-2 font-semibold">
                  {count} question{count !== 1 ? "s" : ""} | Updated {timeAgo(quiz.updated_at)}
                </p>

                <div className="mt-3 flex gap-5">
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/edit?quiz=${quiz.id}`)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-cyan-600 px-2 py-1.5 text-xs font-semibold text-white transition hover:bg-cyan-700 hover:scale-[1.02]"
                  >
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                    </svg>
                    Edit
                  </button>
                  {isDraft ? (
                    <button
                      type="button"
                      onClick={() => void handlePublish(quiz.id)}
                      className={clsx(
                        "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition",
                        count === 0
                          ? "border border-zinc-300 bg-white text-zinc-400"
                          : "bg-orange-500 text-white hover:bg-orange-600 hover:scale-[1.02]",
                      )}
                      disabled={count === 0 || publishingQuizId === quiz.id}
                    >
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
                      </svg>
                      {publishingQuizId === quiz.id ? "Publishing..." : "Publish"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleHost(quiz.id)}
                      className={clsx(
                        "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition",
                        count === 0
                          ? "border border-zinc-300 bg-white text-zinc-400"
                          : "bg-orange-500 text-white hover:bg-orange-600 hover:scale-[1.02]",
                      )}
                      disabled={count === 0 || hostingQuizId === quiz.id}
                    >
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                      </svg>
                      {hostingQuizId === quiz.id ? "Hosting..." : "Host"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteQuiz(quiz)}
                    disabled={loading}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 hover:scale-[1.02] disabled:opacity-50"
                  >
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredQuizzes.length === 0 && (
        <p className="mt-10 text-center text-sm text-black">
          No quizzes yet. Click &quot;+ Create quiz&quot; to get started.
        </p>
      )}
      </div>

      {confirmDeleteQuiz && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !loading && setConfirmDeleteQuiz(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-lg font-bold text-zinc-900">Delete quiz?</h2>
            <p className="mb-5 text-sm text-zinc-600">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-zinc-900 break-all">
                &quot;{confirmDeleteQuiz.title}&quot;
              </span>
              ? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteQuiz(null)}
                disabled={loading}
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 hover:scale-[1.02] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(confirmDeleteQuiz.id)}
                disabled={loading}
                className="rounded-md bg-red-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-600 hover:scale-[1.02] disabled:opacity-50"
              >
                {loading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthenticatedLayout>
  );
}
