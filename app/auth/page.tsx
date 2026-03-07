"use client";

import dynamic from "next/dynamic";

const AuthPanel = dynamic(
  () => import("@/src/features/auth/AuthPanel").then((module) => module.AuthPanel),
  {
    ssr: false,
    loading: () => <p className="mx-auto max-w-3xl text-sm">Loading auth...</p>,
  },
);

export default function AuthPage() {
  return (
    <main className="min-h-screen bg-zinc-100 p-6">
      <AuthPanel />
    </main>
  );
}
