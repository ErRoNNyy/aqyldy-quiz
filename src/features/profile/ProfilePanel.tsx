"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  SiteHeader,
  SiteHeaderActionLink,
} from "@/src/components/layout/SiteHeader";
import {
  deleteUserAccount,
  getCurrentUser,
  getProfileMaybe,
  signOut,
  updateProfile,
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

export function ProfilePanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");

  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [language, setLanguage] = useState<string>(LANGUAGES[0].value);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      if (!isSupabaseConfigured) {
        setMessage(supabaseMissingEnvMessage);
        return;
      }
      const user = await getCurrentUser();
      if (!user) {
        router.replace(`/signin?next=${encodeURIComponent("/profile")}`);
        return;
      }
      setUserId(user.id);
      const p = await getProfileMaybe(user.id);
      if (p) {
        setName(p.name ?? "");
        setSchool(p.school_organization ?? "");
        setLanguage(p.preferred_language ?? LANGUAGES[0].value);
      }
      setReady(true);
    }
    void init();
  }, [router]);

  async function handleSave() {
    if (!userId) return;
    const trimmed = name.trim();
    if (!trimmed || !/^[a-zA-Z0-9]+$/.test(trimmed)) {
      setMessage("Name must use letters and numbers only.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await updateProfile(userId, {
        name: trimmed,
        schoolOrganization: school.trim(),
        preferredLanguage: language.trim(),
      });
      router.push(nextPath || "/home");
      return;
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!userId) return;
    setDeleting(true);
    setMessage("");
    try {
      await deleteUserAccount(userId);
      router.replace("/");
    } catch (e) {
      setMessage((e as Error).message);
      setDeleting(false);
    }
  }

  if (!ready) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader right={<SiteHeaderActionLink href="/home">Home</SiteHeaderActionLink>} />

      <main className="mx-auto flex min-h-[calc(100vh-3.25rem)] max-w-3xl flex-col items-center justify-center px-6 py-10">
        <h1 className="mb-2 text-center text-2xl font-bold text-white">Profile Settings</h1>
        <p className="mb-8 max-w-md text-center text-sm text-cyan-100">
          Update your name, organization, or language.
        </p>

        <form
          className="flex w-full max-w-xl flex-col items-center"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
        >
          <label className="mb-1 w-full max-w-[400px] text-left text-xs font-semibold text-cyan-100">
            Name (letters and numbers only)
          </label>
          <input
            value={name}
            placeholder="e.g. Samat2024"
            onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
            autoComplete="name"
            className="mb-4 h-12 w-full max-w-[400px] rounded-md border border-zinc-300 bg-white px-4 text-center text-lg font-semibold text-zinc-700 outline-none placeholder:text-zinc-400 focus:border-cyan-700"
          />

          <label className="mb-1 w-full max-w-[400px] text-left text-xs font-semibold text-cyan-100">
            School or organization
          </label>
          <input
            value={school}
            placeholder="School or company name"
            onChange={(e) => setSchool(e.target.value)}
            autoComplete="organization"
            className="mb-4 h-12 w-full max-w-[400px] rounded-md border border-zinc-300 bg-white px-4 text-center text-lg font-semibold text-zinc-700 outline-none placeholder:text-zinc-400 focus:border-cyan-700"
          />

          <label className="mb-1 w-full max-w-[400px] text-left text-xs font-semibold text-cyan-100">
            Preferred language
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
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
            disabled={saving}
            className="h-12 w-[220px] rounded-md bg-orange-500 text-xl font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300"
          >
            {saving ? "Saving..." : "Save"}
          </button>

          {message && (
            <p className="mt-4 max-w-md text-center text-sm font-medium text-white">{message}</p>
          )}
        </form>

        <div className="mt-6 pt-2 flex w-full max-w-[400px] flex-col items-center border-t border-white/30">
          <h2 className="mb-2 text-lg font-bold text-white">Danger Zone</h2>
          <p className="mb-4 text-center text-sm text-cyan-100">
            Permanently delete your account and all associated data.
          </p>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-md bg-red-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600"
            >
              Delete Account
            </button>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <p className="text-center text-sm font-bold text-red-200">
                Are you sure? This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => void handleDelete()}
                  disabled={deleting}
                  className="rounded-md bg-red-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Yes, delete my account"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-md bg-zinc-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-8 text-center text-sm text-cyan-200">
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => {
              void signOut().then(() => router.replace("/"));
            }}
          >
            Sign out and use a different account
          </button>
        </p>
      </main>
    </div>
  );
}
