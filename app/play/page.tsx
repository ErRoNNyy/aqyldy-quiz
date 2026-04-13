"use client";

import dynamic from "next/dynamic";

const PlayPanel = dynamic(
  () => import("@/src/features/session/PlayPanel").then((module) => module.PlayPanel),
  {
    ssr: false,
    loading: () => <div className="min-h-screen bg-background" />,
  },
);

export default function PlayPage() {
  return <PlayPanel />;
}
