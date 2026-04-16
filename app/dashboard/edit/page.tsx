"use client";

import dynamic from "next/dynamic";

const QuizBuilder = dynamic(
  () => import("@/src/features/quiz/QuizBuilder").then((m) => m.QuizBuilder),
  {
    ssr: false,
    loading: () => <div className="min-h-screen bg-background" />,
  },
);

export default function EditQuizPage() {
  return <QuizBuilder />;
}
