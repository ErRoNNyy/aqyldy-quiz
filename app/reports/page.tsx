"use client";

import dynamic from "next/dynamic";

const ReportsPanel = dynamic(
  () => import("@/src/features/reports/ReportsPanel").then((m) => m.ReportsPanel),
  {
    ssr: false,
    loading: () => <p className="p-6 text-sm">Loading reports...</p>,
  },
);

export default function ReportsPage() {
  return <ReportsPanel />;
}
