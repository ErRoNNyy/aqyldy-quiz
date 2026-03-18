"use client";

import dynamic from "next/dynamic";

const JoinPanel = dynamic(
  () => import("@/src/features/session/JoinPanel").then((module) => module.JoinPanel),
  {
    ssr: false,
    loading: () => <p className="mx-auto max-w-3xl text-sm">Loading join...</p>,
  },
);

export default function JoinPage() {
  return (
    <main>
      <JoinPanel />
    </main>
  );
}
