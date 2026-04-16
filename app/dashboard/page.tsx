"use client";

import dynamic from "next/dynamic";

const DashboardPanel = dynamic(
  () => import("@/src/features/quiz/DashboardPanel").then((m) => m.DashboardPanel),
  {
    ssr: false,
    loading: () => <div className="min-h-screen bg-background" />,
  },
);

export default function DashboardPage() {
  return <DashboardPanel />;
}
