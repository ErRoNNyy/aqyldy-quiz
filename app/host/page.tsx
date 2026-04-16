"use client";

import dynamic from "next/dynamic";

const HostPanel = dynamic(
  () => import("@/src/features/session/HostPanel").then((module) => module.HostPanel),
  {
    ssr: false,
    loading: () => <div className="min-h-screen bg-background" />,
  },
);

export default function HostPage() {
  return <HostPanel />;
}
