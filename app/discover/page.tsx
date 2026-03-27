"use client";

import dynamic from "next/dynamic";

const DiscoverPanel = dynamic(
  () => import("@/src/features/discover/DiscoverPanel").then((m) => m.DiscoverPanel),
  {
    ssr: false,
    loading: () => <p className="p-6 text-sm">Loading discover...</p>,
  },
);

export default function DiscoverPage() {
  return <DiscoverPanel />;
}
