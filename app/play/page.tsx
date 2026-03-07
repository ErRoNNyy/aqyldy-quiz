"use client";

import dynamic from "next/dynamic";

const PlayPanel = dynamic(
  () => import("@/src/features/session/PlayPanel").then((module) => module.PlayPanel),
  {
    ssr: false,
    loading: () => <p className="mx-auto max-w-3xl text-sm">Loading session...</p>,
  },
);

export default function PlayPage() {
  return (
    <main className="min-h-screen bg-zinc-100 p-6">
      <PlayPanel />
    </main>
  );
}
