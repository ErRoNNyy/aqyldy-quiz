"use client";

import dynamic from "next/dynamic";

const QuizBuilder = dynamic(
  () => import("@/src/features/quiz/QuizBuilder").then((m) => m.QuizBuilder),
  {
    ssr: false,
    loading: () => <p className="p-6 text-sm">Loading editor...</p>,
  },
);

export default function EditQuizPage() {
  return <QuizBuilder />;
}
