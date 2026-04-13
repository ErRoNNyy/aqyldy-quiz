import { Suspense } from "react";
import { AuthFormPage } from "@/src/features/auth/AuthFormPage";

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <AuthFormPage mode="signin" />
    </Suspense>
  );
}
