"use client";

import dynamic from "next/dynamic";

const DiscoverPanel = dynamic(
  () => import("@/src/features/discover/DiscoverPanel").then((m) => m.DiscoverPanel),
  {
    ssr: false,
    loading: () => <div className="min-h-screen bg-background" />,
  },
);

export default function DiscoverPage() {
  return <DiscoverPanel />;
}
