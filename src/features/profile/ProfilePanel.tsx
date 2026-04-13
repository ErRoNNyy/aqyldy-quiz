"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  SiteHeader,
  SiteHeaderActionLink,
} from "@/src/components/layout/SiteHeader";
import {
  completeProfile,
  ensureProfile,
  getCurrentUser,
  getProfileMaybe,
  isProfileComplete,
  signOut,
} from "@/src/services/supabase/api";
import {
  isSupabaseConfigured,
  supabaseMissingEnvMessage,
} from "@/src/services/supabase/client";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "kk", label: "Kazakh" },
  { value: "ru", label: "Russian" },
] as const;

function defaultUsernameFromEmail(email: string | undefined) {
  const base = email?.split("@")[0]?.trim();
  return base || `user_${Date.now()}`;
}

export function ProfilePanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/home";

  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [language, setLanguage] = useState<string>(LANGUAGES[0].value);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function gate() {
      if (!isSupabaseConfigured) {
        setMessage(supabaseMissingEnvMessage);
        return;
      }
      const user = await getCurrentUser();
      if (!user) {
        router.replace(`/signin?next=${encodeURIComponent("/profile")}`);
        return;
      }
      await ensureProfile(user, defaultUsernameFromEmail(user.email ?? undefined));
      const profile = await getProfileMaybe(user.id);
      if (isProfileComplete(profile)) {
        router.replace(nextPath);
      }
    }
    void gate();
  }, [router, nextPath]);

  async function handleSubmit() {
    if (!isSupabaseConfigured) return;
    const user = await getCurrentUser();
    if (!user) {
      router.replace("/signin");
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName || !/^[a-zA-Z0-9]+$/.test(trimmedName)) {
      setMessage("Name must use letters and numbers only.");
      return;
    }
    if (!school.trim()) {
      setMessage("School or organization is required.");
      return;
    }
    if (!language.trim()) {
      setMessage("Choose a preferred language.");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      await completeProfile(user.id, {
        name: trimmedName,
        schoolOrganization: school.trim(),
        preferredLanguage: language.trim(),
      });
      router.replace(nextPath);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader right={<SiteHeaderActionLink href="/">Home</SiteHeaderActionLink>} />

      <main className="mx-auto flex min-h-[calc(100vh-3.25rem)] max-w-3xl flex-col items-center justify-center px-6 py-10">
        <h1 className="mb-2 text-center text-2xl font-bold text-white">Complete your profile</h1>
        <p className="mb-8 max-w-md text-center text-sm text-cyan-100">
          Tell us how to address you and where you&apos;re from. You can change this later in account
          settings when that feature is available.
        </p>

        <form
          className="flex w-full max-w-xl flex-col items-center"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <label className="mb-1 w-full max-w-[400px] text-left text-xs font-semibold text-cyan-100">
            Name (letters and numbers only)
          </label>
          <input
            value={name}
            placeholder="e.g. Samat2024"
            onChange={(event) => setName(event.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
            autoComplete="name"
            className="mb-4 h-12 w-full max-w-[400px] rounded-md border border-zinc-300 bg-white px-4 text-center text-lg font-semibold text-zinc-700 outline-none placeholder:text-zinc-400 focus:border-cyan-700"
          />

          <label className="mb-1 w-full max-w-[400px] text-left text-xs font-semibold text-cyan-100">
            School or organization
          </label>
          <input
            value={school}
            placeholder="School or company name"
            onChange={(event) => setSchool(event.target.value)}
            autoComplete="organization"
            className="mb-4 h-12 w-full max-w-[400px] rounded-md border border-zinc-300 bg-white px-4 text-center text-lg font-semibold text-zinc-700 outline-none placeholder:text-zinc-400 focus:border-cyan-700"
          />

          <label className="mb-1 w-full max-w-[400px] text-left text-xs font-semibold text-cyan-100">
            Preferred language
          </label>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="mb-8 h-12 w-full max-w-[400px] rounded-md border border-zinc-300 bg-white px-4 text-center text-lg font-semibold text-zinc-700 outline-none focus:border-cyan-700"
          >
            {LANGUAGES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={loading}
            className="h-12 w-[220px] rounded-md bg-orange-500 text-xl font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300"
          >
            {loading ? "Saving..." : "Continue"}
          </button>

          {message && (
            <p className="mt-4 max-w-md text-center text-sm font-medium text-white">{message}</p>
          )}

          <p className="mt-6 text-center text-sm text-cyan-200">
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => {
                void signOut().then(() => router.replace("/signin"));
              }}
            >
              Sign out and use a different account
            </button>
          </p>
        </form>
      </main>
    </div>
  );
}
