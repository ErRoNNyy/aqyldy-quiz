"use client";

import dynamic from "next/dynamic";

const ReportsPanel = dynamic(
  () => import("@/src/features/reports/ReportsPanel").then((m) => m.ReportsPanel),
  {
    ssr: false,
    loading: () => <div className="min-h-screen bg-background" />,
  },
);

export default function ReportsPage() {
  return <ReportsPanel />;
}
