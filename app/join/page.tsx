"use client";

import dynamic from "next/dynamic";

const JoinPanel = dynamic(
  () => import("@/src/features/session/JoinPanel").then((module) => module.JoinPanel),
  {
    ssr: false,
    loading: () => <div className="min-h-screen bg-cyan-500" />,
  },
);

export default function JoinPage() {
  return <JoinPanel />;
}
