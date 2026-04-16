"use client";

import dynamic from "next/dynamic";

const ProfilePanel = dynamic(
  () => import("@/src/features/profile/ProfilePanel").then((m) => m.ProfilePanel),
  {
    ssr: false,
    loading: () => <div className="min-h-screen bg-background" />,
  },
);

export default function ProfilePage() {
  return <ProfilePanel />;
}
