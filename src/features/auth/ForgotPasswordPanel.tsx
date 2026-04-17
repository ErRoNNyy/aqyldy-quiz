"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  SiteHeader,
  SiteHeaderActionLink,
} from "@/src/components/layout/SiteHeader";
import {
  requestPasswordReset,
  resetPassword,
  verifyPasswordResetOtp,
} from "@/src/services/supabase/api";
import {
  isSupabaseConfigured,
  supabaseMissingEnvMessage,
} from "@/src/services/supabase/client";

type Step = "email" | "otp" | "password";

export function ForgotPasswordPanel() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSendCode() {
    if (!isSupabaseConfigured) {
      setMessage(supabaseMissingEnvMessage);
      return;
    }
    if (!email.trim()) {
      setMessage("Please enter your email.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      await requestPasswordReset(email.trim());
      setStep("otp");
      setMessage("A verification code has been sent to your email.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    const code = otp.trim();
    if (!code || code.length < 6) {
      setMessage("Please enter the verification code.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      await verifyPasswordResetOtp(email.trim(), code);
      setStep("password");
      setMessage("");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!password.trim()) {
      setMessage("Password cannot be empty.");
      return;
    }
    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      await resetPassword(password);
      setMessage("Password reset successfully! Redirecting...");
      setTimeout(() => router.push("/signin"), 1500);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const EyeOpen = (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );

  const EyeClosed = (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader right={<SiteHeaderActionLink href="/signin">Sign in</SiteHeaderActionLink>} />

      <main className="mx-auto flex min-h-[calc(100vh-3.25rem)] max-w-3xl items-center justify-center px-6">
        <form
          className="flex w-full max-w-xl flex-col items-center"
          onSubmit={(e) => {
            e.preventDefault();
            if (step === "email") void handleSendCode();
            else if (step === "otp") void handleVerifyOtp();
            else void handleResetPassword();
          }}
        >
          <h1 className="mb-2 text-2xl font-bold text-white">Reset Password</h1>

          {step === "email" && (
            <>
              <p className="mb-6 text-center text-sm text-cyan-100">
                Enter your email and we&apos;ll send you a verification code.
              </p>
              <input
                value={email}
                placeholder="Enter your email"
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="mb-6 h-14 w-full max-w-[400px] rounded-md border border-zinc-300 bg-white px-4 text-center text-xl font-semibold text-zinc-700 outline-none placeholder:text-zinc-400 focus:border-cyan-700"
              />
              <button
                type="submit"
                disabled={loading}
                className="h-12 w-[220px] rounded-md bg-orange-500 text-xl font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300"
              >
                {loading ? "Sending..." : "Send Code"}
              </button>
            </>
          )}

          {step === "otp" && (
            <>
              <p className="mb-6 text-center text-sm text-cyan-100">
                We sent a verification code to <strong>{email}</strong>. Enter it below.
              </p>
              <input
                value={otp}
                placeholder="Enter code"
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
                inputMode="numeric"
                autoComplete="one-time-code"
                className="mb-6 h-14 w-full max-w-[400px] rounded-md border border-zinc-300 bg-white px-4 text-center text-3xl font-bold tracking-[0.5em] text-zinc-700 outline-none placeholder:text-lg placeholder:font-semibold placeholder:tracking-normal focus:border-cyan-700"
              />
              <button
                type="submit"
                disabled={loading}
                className="h-12 w-[220px] rounded-md bg-orange-500 text-xl font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300"
              >
                {loading ? "Verifying..." : "Verify Code"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setOtp("");
                  setMessage("");
                }}
                className="mt-3 text-sm font-semibold text-cyan-100 underline underline-offset-2"
              >
                Use a different email
              </button>
            </>
          )}

          {step === "password" && (
            <>
              <p className="mb-6 text-center text-sm text-cyan-100">
                Code verified! Set your new password.
              </p>
              <div className="mb-3 flex h-14 w-full max-w-[400px] items-center rounded-md border border-zinc-300 bg-white focus-within:border-cyan-700">
                <input
                  value={password}
                  type={showPassword ? "text" : "password"}
                  placeholder="New password"
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-full min-w-0 flex-1 rounded-md bg-transparent pl-12 text-center text-xl font-semibold text-zinc-700 outline-none placeholder:text-zinc-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="flex h-full w-12 shrink-0 items-center justify-center text-zinc-400 transition hover:text-zinc-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? EyeClosed : EyeOpen}
                </button>
              </div>
              <div className="mb-6 flex h-14 w-full max-w-[400px] items-center rounded-md border border-zinc-300 bg-white focus-within:border-cyan-700">
                <input
                  value={confirmPassword}
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-full min-w-0 flex-1 rounded-md bg-transparent pl-12 text-center text-xl font-semibold text-zinc-700 outline-none placeholder:text-zinc-400"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="flex h-full w-12 shrink-0 items-center justify-center text-zinc-400 transition hover:text-zinc-700"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? EyeClosed : EyeOpen}
                </button>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="h-12 w-[220px] rounded-md bg-orange-500 text-xl font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300"
              >
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </>
          )}

          {message && (
            <p className="mt-4 max-w-md text-center text-sm font-medium text-white">{message}</p>
          )}

          <p className="mt-6 text-sm font-semibold text-cyan-100">
            <Link href="/signin" className="underline underline-offset-2">
              Back to Sign in
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}
