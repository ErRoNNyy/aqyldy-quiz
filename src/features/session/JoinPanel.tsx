"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addParticipant,
  findSessionByCode,
  getCurrentUser,
} from "@/src/services/supabase/api";
import { isSupabaseConfigured } from "@/src/services/supabase/client";

export function JoinPanel() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function join() {
    if (!isSupabaseConfigured) {
      setStatus("Configure Supabase ENV first.");
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
      const user = await getCurrentUser();
      const guestNickname = localStorage.getItem("kahootkz_guest_nickname") ?? "";
      const finalNickname = guestNickname || "Guest";
      const participant = await addParticipant(session.id, finalNickname, user?.id);
      router.push(`/play?session=${session.id}&participant=${participant.id}`);
    } catch (error) {
      setStatus((error as Error).message);
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

      <main className="mx-auto flex min-h-[calc(100vh-57px)] max-w-4xl items-center justify-center px-6">
        <form
          className="flex w-full max-w-xl flex-col items-center"
          onSubmit={(event) => {
            event.preventDefault();
            void join();
          }}
        >
          <h1 className="mb-10 text-center text-4xl font-bold tracking-wide text-white">JOIN QUIZ!</h1>
          <input
            value={code}
            placeholder="Enter code"
            onChange={(event) => setCode(event.target.value)}
            className="mb-4 h-14 w-full max-w-[280px] rounded-md border border-zinc-300 bg-white px-4 text-center text-xl font-semibold text-zinc-700 outline-none placeholder:text-zinc-400 focus:border-cyan-700"
          />
          <button
            type="submit"
            disabled={loading}
            className="h-12 w-[220px] rounded-md bg-orange-500 text-2xl font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300"
          >
            {loading ? "..." : "Enter"}
          </button>
          {status && <p className="mt-4 text-center text-sm font-medium text-white">{status}</p>}
        </form>
      </main>
    </div>
  );
}
