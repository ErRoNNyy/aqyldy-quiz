import { Suspense } from "react";
import { AuthFormPage } from "@/src/features/auth/AuthFormPage";

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#1fb6c4]" />}>
      <AuthFormPage mode="signin" />
    </Suspense>
  );
}
