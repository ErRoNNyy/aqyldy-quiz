"use client";

import dynamic from "next/dynamic";

const LobbyPanel = dynamic(
  () => import("@/src/features/session/LobbyPanel").then((m) => m.LobbyPanel),
  {
    ssr: false,
    loading: () => <div className="min-h-screen bg-background" />,
  },
);

export default function LobbyPage() {
  return <LobbyPanel />;
}
