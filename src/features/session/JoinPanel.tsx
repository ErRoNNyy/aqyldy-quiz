"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  SiteHeader,
  SiteHeaderActionLink,
} from "@/src/components/layout/SiteHeader";
import { findSessionByCode } from "@/src/services/supabase/api";
import {
  isSupabaseConfigured,
  supabaseMissingEnvMessage,
} from "@/src/services/supabase/client";

export function JoinPanel() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function join() {
    if (!isSupabaseConfigured) {
      setStatus(supabaseMissingEnvMessage);
      return;
    }
    if (!code.trim()) {
      setStatus("Session code is required.");
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      const session = await findSessionByCode(code.trim());
      router.push(`/lobby?session=${session.id}`);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader right={<SiteHeaderActionLink href="/">Home</SiteHeaderActionLink>} />

      <main className="flex flex-1 items-center justify-center px-6">
        <form
          className="flex w-full max-w-xs flex-col items-center"
          onSubmit={(e) => {
            e.preventDefault();
            void join();
          }}
        >
          <input
            value={code}
            placeholder="Enter code"
            onChange={(e) => setCode(e.target.value)}
            className="mb-5 h-12 w-full rounded-md border border-zinc-300 bg-white px-4 text-center text-base font-medium text-zinc-700 outline-none placeholder:text-zinc-400 focus:border-white"
          />
          <button
            type="submit"
            disabled={loading}
            className="h-11 w-48 rounded-md bg-orange-500 text-lg font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
          >
            {loading ? "..." : "Enter"}
          </button>
          {status && (
            <p className="mt-4 text-center text-sm font-medium text-white">{status}</p>
          )}
        </form>
      </main>
    </div>
  );
}
