"use client";

import dynamic from "next/dynamic";

const DashboardPanel = dynamic(
  () => import("@/src/features/quiz/DashboardPanel").then((m) => m.DashboardPanel),
  {
    ssr: false,
    loading: () => <p className="p-6 text-sm">Loading dashboard...</p>,
  },
);

export default function DashboardPage() {
  return <DashboardPanel />;
}
