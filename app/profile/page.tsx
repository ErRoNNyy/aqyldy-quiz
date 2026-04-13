"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const ProfilePanel = dynamic(
  () => import("@/src/features/profile/ProfilePanel").then((m) => m.ProfilePanel),
  {
    ssr: false,
    loading: () => <div className="min-h-screen bg-background p-6 text-sm text-white">Loading…</div>,
  },
);

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ProfilePanel />
    </Suspense>
  );
}
