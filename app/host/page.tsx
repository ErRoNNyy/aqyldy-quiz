"use client";

import dynamic from "next/dynamic";

const HostPanel = dynamic(
  () => import("@/src/features/session/HostPanel").then((module) => module.HostPanel),
  {
    ssr: false,
    loading: () => <p className="mx-auto max-w-3xl text-sm">Loading host...</p>,
  },
);

export default function HostPage() {
  return <HostPanel />;
}
