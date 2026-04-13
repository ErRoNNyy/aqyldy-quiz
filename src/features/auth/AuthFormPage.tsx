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
