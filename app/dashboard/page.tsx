"use client";

import dynamic from "next/dynamic";

const QuizBuilder = dynamic(
  () => import("@/src/features/quiz/QuizBuilder").then((module) => module.QuizBuilder),
  {
    ssr: false,
    loading: () => <p className="mx-auto max-w-3xl text-sm">Loading dashboard...</p>,
  },
);

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-zinc-100 p-6">
      <QuizBuilder />
    </main>
  );
}
