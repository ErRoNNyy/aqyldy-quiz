"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  SiteHeader,
  SiteHeaderActionLink,
} from "@/src/components/layout/SiteHeader";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ensureProfile,
  getCurrentUser,
  getProfileMaybe,
  isProfileComplete,
  signIn,
  signUp,
} from "@/src/services/supabase/api";
import { profileSetupUrl } from "@/src/services/supabase/profileRoutes";
import {
  isSupabaseConfigured,
  supabaseMissingEnvMessage,
} from "@/src/services/supabase/client";

type AuthMode = "signin" | "signup";

interface AuthFormPageProps {
  mode: AuthMode;
}

function getDefaultUsername(email: string) {
  const base = email.split("@")[0]?.trim();
  return base || `user_${Date.now()}`;
}

export function AuthFormPage({ mode }: AuthFormPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const isSignUp = useMemo(() => mode === "signup", [mode]);
  const submitText = isSignUp ? "Create account" : "Sign in";

  async function handleSubmit() {
    if (!isSupabaseConfigured) {
      setMessage(supabaseMissingEnvMessage);
      return;
    }

    if (!email.trim() || !password.trim()) {
      setMessage("Email and password are required.");
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    setMessage("");

    const destination = nextPath || "/home";

    try {
      if (isSignUp) {
        const { data, error } = await signUp(email.trim(), password);
        if (error) {
          throw error;
        }

        if (data.session) {
          const user = await getCurrentUser();
          if (user) {
            await ensureProfile(user, getDefaultUsername(email));
          }
          router.push(profileSetupUrl(destination));
          return;
        }

        setMessage("Account created. Check your email for a confirmation link, then sign in.");
        setTimeout(() => router.push("/signin"), 2000);
        return;
      }

      const { error } = await signIn(email.trim(), password);
      if (error) {
        throw error;
      }

      const user = await getCurrentUser();
      if (user) {
        await ensureProfile(user, getDefaultUsername(email));
        const profile = await getProfileMaybe(user.id);
        if (!isProfileComplete(profile)) {
          router.push(profileSetupUrl(destination));
          return;
        }
      }

      router.push(destination);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader right={<SiteHeaderActionLink href="/">Home</SiteHeaderActionLink>} />

      <main className="mx-auto flex min-h-[calc(100vh-3.25rem)] max-w-3xl items-center justify-center px-6">
        <form
          className="flex w-full max-w-xl flex-col items-center"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <input
            value={email}
            placeholder="Enter email"
            onChange={(event) => setEmail(event.target.value)}
            className="mb-3 h-14 w-full max-w-[400px] rounded-md border border-zinc-300 bg-white px-4 text-center text-xl font-semibold text-zinc-700 outline-none placeholder:text-zinc-400 focus:border-cyan-700"
          />
          <div className="mb-3 flex h-14 w-full max-w-[400px] items-center rounded-md border border-zinc-300 bg-white focus-within:border-cyan-700">
            <input
              value={password}
              type={showPassword ? "text" : "password"}
              placeholder={isSignUp ? "Create password" : "Enter password"}
              onChange={(event) => setPassword(event.target.value)}
              className="h-full min-w-0 flex-1 rounded-md bg-transparent pl-12 text-center text-xl font-semibold text-zinc-700 outline-none placeholder:text-zinc-400"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="flex h-full w-12 shrink-0 items-center justify-center text-zinc-400 transition hover:text-zinc-700"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              )}
            </button>
          </div>
          {isSignUp && (
            <div className="mb-8 flex h-14 w-full max-w-[400px] items-center rounded-md border border-zinc-300 bg-white focus-within:border-cyan-700">
              <input
                value={confirmPassword}
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm password"
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="h-full min-w-0 flex-1 rounded-md bg-transparent pl-12 text-center text-xl font-semibold text-zinc-700 outline-none placeholder:text-zinc-400"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="flex h-full w-12 shrink-0 items-center justify-center text-zinc-400 transition hover:text-zinc-700"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? (
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                )}
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`h-12 w-[220px] rounded-md bg-orange-500 text-2xl font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300 ${isSignUp ? "" : "mt-5"}`}
          >
            {loading ? "..." : submitText}
          </button>

          {!isSignUp && (
            <div className="mt-2 text-center">
              <p className="text-sm font-semibold text-cyan-100">
                <Link href="/forgot-password" className="underline underline-offset-2">
                  Forgot password?
                </Link>
              </p>
              <p className="mt-1 text-sm font-semibold text-cyan-100">
                <Link href="/signup" className="underline underline-offset-2">
                  Don&apos;t have an account? Sign up
                </Link>
              </p>
            </div>
          )}

          {message && <p className="mt-4 text-center text-sm font-medium text-white">{message}</p>}
        </form>
      </main>
    </div>
  );
}
