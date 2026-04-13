"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthenticatedLayout } from "@/src/components/layout/AuthenticatedLayout";
import {
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

export function HomePanel() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function init() {
      if (!isSupabaseConfigured) return;
      const user = await getCurrentUser();
      if (!user) {
        router.replace("/signin?next=/home");
        return;
      }
      const fallback = user.email?.split("@")[0] ?? "user";
      await ensureProfile(user, fallback);
      const profile = await getProfileMaybe(user.id);
      if (!isProfileComplete(profile)) {
        router.replace(profileSetupUrl("/home"));
        return;
      }
      setUsername(profile?.name ?? profile?.username ?? fallback);

      const rows = await getMyQuizzes(user.id);
      setQuizzes(rows);
      const counts = await getQuestionCountsForQuizzes(rows.map((q) => q.id));
      setQuestionCounts(counts);
    }
    void init();
  }, [router]);

  const recentQuizzes = quizzes.slice(0, 3);

  return (
    <AuthenticatedLayout username={username}>
      <div className="flex-1 bg-background p-6">
        <h1 className="mb-5 text-xl font-bold text-white">
          What would you like to do today?
        </h1>

        <div className="mb-8 flex gap-4">
          <Link
            href="/dashboard/edit"
            className="rounded-lg bg-orange-500 px-10 py-3 text-lg font-semibold text-white transition hover:bg-orange-600"
          >
            Create quiz
          </Link>
          <Link
            href="/discover"
            className="rounded-lg bg-cyan-600 px-10 py-3 text-lg font-semibold text-white transition hover:bg-cyan-700"
          >
            Discover
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <div className="mb-3 rounded-t-lg bg-orange-500 px-5 py-2 text-center text-sm font-bold text-white">
              What&apos;s new
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="h-12 w-12 shrink-0 rounded-full bg-zinc-200" />
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <h3 className="text-sm font-bold text-cyan-700">History Quiz is Here!</h3>
                    <span className="rounded bg-cyan-100 px-2 py-0.5 text-[10px] font-bold text-cyan-600">NEW</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">New feature: Complete against the clock in timed quiz challenge!</p>
                  <button className="mt-2 rounded-full bg-orange-500 px-4 py-1 text-xs font-semibold text-white">Try now</button>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="h-12 w-12 shrink-0 rounded-full bg-zinc-200" />
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <h3 className="text-sm font-bold text-cyan-700">Challenge Mode</h3>
                    <span className="rounded bg-cyan-100 px-2 py-0.5 text-[10px] font-bold text-cyan-600">NEW FEATURE</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">New feature: Complete against the clock in timed quiz challenge!</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="h-12 w-12 shrink-0 rounded-full bg-zinc-200" />
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-cyan-700">Daily Facts and Tips</h3>
                  <p className="mt-1 text-xs text-zinc-500">Learn something new every day with our tools and quizzes</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-3 rounded-t-lg bg-cyan-600 px-5 py-2 text-center text-sm font-bold text-white">
              Your activities
            </div>
            <div className="space-y-3">
              {recentQuizzes.length === 0 && (
                <p className="rounded-xl border border-zinc-200 bg-white p-4 text-center text-sm text-zinc-500">
                  No quizzes yet. Create one to get started!
                </p>
              )}
              {recentQuizzes.map((quiz) => {
                const count = questionCounts[quiz.id] ?? 0;
                const isDraft = count === 0;
                return (
                  <div key={quiz.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-zinc-800">
                      {isDraft ? "DRAFT" : "HOST"}: {quiz.title}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-500">Learn something new every day with our tools and quizzes</p>
                    <Link
                      href={isDraft ? `/dashboard/edit?quiz=${quiz.id}` : `/host?quiz=${quiz.id}`}
                      className="mt-2 inline-block rounded-full bg-orange-500 px-4 py-1 text-xs font-semibold text-white transition hover:bg-orange-600"
                    >
                      Continue
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
