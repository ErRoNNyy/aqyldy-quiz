"use client";

import dynamic from "next/dynamic";

const HomePanel = dynamic(
  () => import("@/src/features/home/HomePanel").then((m) => m.HomePanel),
  {
    ssr: false,
    loading: () => <p className="p-6 text-sm">Loading home...</p>,
  },
);

export default function HomePage() {
  return <HomePanel />;
}
