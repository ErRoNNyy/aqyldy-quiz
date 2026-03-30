"use client";

import dynamic from "next/dynamic";

const LobbyPanel = dynamic(
  () => import("@/src/features/session/LobbyPanel").then((m) => m.LobbyPanel),
  {
    ssr: false,
    loading: () => <p className="mx-auto max-w-3xl text-sm">Loading...</p>,
  },
);

export default function LobbyPage() {
  return <LobbyPanel />;
}
