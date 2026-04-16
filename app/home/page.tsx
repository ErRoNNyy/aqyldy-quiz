"use client";

import dynamic from "next/dynamic";

const HomePanel = dynamic(
  () => import("@/src/features/home/HomePanel").then((m) => m.HomePanel),
  {
    ssr: false,
    loading: () => <div className="min-h-screen bg-background" />,
  },
);

export default function HomePage() {
  return <HomePanel />;
}
