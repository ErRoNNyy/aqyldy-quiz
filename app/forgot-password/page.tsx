"use client";

import dynamic from "next/dynamic";

const ForgotPasswordPanel = dynamic(
  () =>
    import("@/src/features/auth/ForgotPasswordPanel").then(
      (m) => m.ForgotPasswordPanel,
    ),
  {
    ssr: false,
    loading: () => <div className="min-h-screen bg-background" />,
  },
);

export default function ForgotPasswordPage() {
  return <ForgotPasswordPanel />;
}
