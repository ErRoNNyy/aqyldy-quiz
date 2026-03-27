"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ensureProfile, getCurrentUser, signIn, signUp } from "@/src/services/supabase/api";
import { isSupabaseConfigured } from "@/src/services/supabase/client";

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
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const isSignUp = useMemo(() => mode === "signup", [mode]);
  const submitText = isSignUp ? "Create account" : "Sign in";

  async function handleSubmit() {
    if (!isSupabaseConfigured) {
      setMessage(
        "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY) first.",
      );
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

    try {
      if (isSignUp) {
        const { error } = await signUp(email.trim(), password);
        if (error) {
          throw error;
        }

        setMessage("Account created! Check your email to confirm, then sign in.");
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
      }

      router.push(nextPath || "/home");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-cyan-500">
      <header className="flex items-center justify-between bg-orange-500 px-11 py-2">
        <Link href="/" className="text-2xl font-semibold text-white">
          Aqyldy quiz
        </Link>
        <Link
          href="/"
          className="rounded-md bg-cyan-500 px-5 py-1.5 text-sm font-semibold text-white transition hover:bg-cyan-600"
        >
          Home
        </Link>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-57px)] max-w-3xl items-center justify-center px-6">
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
          <input
            value={password}
            type="password"
            placeholder={isSignUp ? "Create password" : "Enter password"}
            onChange={(event) => setPassword(event.target.value)}
            className="mb-3 h-14 w-full max-w-[400px] rounded-md border border-zinc-300 bg-white px-4 text-center text-xl font-semibold text-zinc-700 outline-none placeholder:text-zinc-400 focus:border-cyan-700"
          />
          {isSignUp && (
            <input
              value={confirmPassword}
              type="password"
              placeholder="Confirm password"
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="mb-8 h-14 w-full max-w-[400px] rounded-md border border-zinc-300 bg-white px-4 text-center text-xl font-semibold text-zinc-700 outline-none placeholder:text-zinc-400 focus:border-cyan-700"
            />
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
              <p className="text-sm font-semibold text-cyan-100">Forgot password?</p>
              <p className="mt-1 text-sm font-semibold text-cyan-100">
                <Link href="/signup" className="underline underline-offset-2">
                Don't have an account?{" "} Sign up
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
