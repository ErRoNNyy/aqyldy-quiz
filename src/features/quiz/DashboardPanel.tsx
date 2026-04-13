"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { AuthenticatedLayout } from "@/src/components/layout/AuthenticatedLayout";
import {
  deleteQuiz,
  ensureProfile,
  getCurrentUser,
  getMyQuizzes,
  getProfileMaybe,
  getQuestionCountsForQuizzes,
  isProfileComplete,
} from "@/src/services/supabase/api";
import { profileSetupUrl } from "@/src/services/supabase/profileRoutes";
import { isSupabaseConfigured } from "@/src/services/supabase/client";
import type { Quiz } from "@/src/types/models";

type Filter = "all" | "draft" | "not_hosted";

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
  const [username, setUsername] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const loadQuizzes = useCallback(async (uid: string) => {
    const rows = await getMyQuizzes(uid);
    setQuizzes(rows);
    const ids = rows.map((q) => q.id);
    const counts = await getQuestionCountsForQuizzes(ids);
    setQuestionCounts(counts);
  }, []);

  useEffect(() => {
    async function init() {
      if (!isSupabaseConfigured) {
        setStatus("Configure Supabase ENV first.");
        return;
      }
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.replace("/signin?next=/dashboard");
          return;
        }
        const fallback = user.email?.split("@")[0] ?? "user";
        await ensureProfile(user, fallback);
        const profile = await getProfileMaybe(user.id);
        if (!isProfileComplete(profile)) {
          router.replace(profileSetupUrl("/dashboard"));
          return;
        }
        setUsername(profile?.name ?? profile?.username ?? fallback);
        setUserId(user.id);
        await loadQuizzes(user.id);
      } catch (error) {
        setStatus((error as Error).message);
      }
    }
    void init();
  }, [loadQuizzes, router]);

  const filteredQuizzes = quizzes.filter((quiz) => {
    if (filter === "draft") {
      return (questionCounts[quiz.id] ?? 0) === 0;
    }
    return true;
  });

  async function handleDelete(quizId: string) {
    if (!userId) return;
    setLoading(true);
    try {
      await deleteQuiz(quizId);
      await loadQuizzes(userId);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "draft", label: "Draft" },
    { key: "not_hosted", label: "Not hosted" },
  ];

  return (
    <AuthenticatedLayout username={username}>
      <div className="flex-1 bg-background p-6">
      <div className="mb-5 flex max-w-md gap-3">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={clsx(
              "flex-1 rounded-full px-3 py-1.5 text-center text-sm font-semibold transition sm:px-4",
              filter === f.key
                ? "bg-orange-500 text-white"
                : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50",
            )}
          >
            {f.label}
          </button>
        ))}

      </div>

      {status && <p className="mb-4 text-sm font-medium text-red-600">{status}</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        {filteredQuizzes.map((quiz) => {
          const count = questionCounts[quiz.id] ?? 0;
          const isDraft = count === 0;

          return (
            <div
              key={quiz.id}
              className="flex items-start gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-zinc-400">
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                </svg>
              </div>

              <div className="flex flex-1 flex-col">
                <div className="flex items-start justify-between">
                  <h3 className="text-base font-bold text-zinc-900">{quiz.title}</h3>
                  {isDraft && (
                    <span className="rounded bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-600">
                      DRAFT
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {count} question{count !== 1 ? "s" : ""} | Updated {timeAgo(quiz.created_at)}
                </p>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/edit?quiz=${quiz.id}`)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-teal-600 px-2 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-700"
                  >
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                    </svg>
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/host?quiz=${quiz.id}`)}
                    className={clsx(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition",
                      isDraft
                        ? "border border-zinc-300 bg-white text-zinc-400"
                        : "bg-orange-500 text-white hover:bg-orange-600",
                    )}
                    disabled={isDraft}
                  >
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                    </svg>
                    Host
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(quiz.id)}
                    disabled={loading}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
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
        <p className="mt-10 text-center text-sm text-white">
          No quizzes yet. Click &quot;+ Create quiz&quot; to get started.
        </p>
      )}
      </div>
    </AuthenticatedLayout>
  );
}
