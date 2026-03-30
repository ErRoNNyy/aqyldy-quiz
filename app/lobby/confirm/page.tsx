"use client";

import dynamic from "next/dynamic";

const LobbyConfirm = dynamic(
  () =>
    import("@/src/features/session/LobbyConfirm").then((m) => m.LobbyConfirm),
  {
    ssr: false,
    loading: () => <div className="min-h-screen bg-cyan-500" />,
  },
);

export default function LobbyConfirmPage() {
  return <LobbyConfirm />;
}
