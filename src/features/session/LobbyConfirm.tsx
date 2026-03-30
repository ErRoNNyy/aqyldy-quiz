"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { addParticipant, getCurrentUser } from "@/src/services/supabase/api";

export function LobbyConfirm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session") ?? "";
  const name = searchParams.get("name") ?? "Guest";
  const avatar = searchParams.get("avatar") ?? "";

  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  function handleEdit() {
    router.push(`/lobby?session=${sessionId}`);
  }

  async function handleJoin() {
    if (!sessionId) {
      setStatus("No session found.");
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      const user = await getCurrentUser();
      const participant = await addParticipant(sessionId, name, user?.id, avatar);
      router.push(`/play?session=${sessionId}&participant=${participant.id}`);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-cyan-500">
      <header className="flex items-center justify-between bg-orange-500 px-6 py-2.5">
        <Link href="/" className="text-xl font-bold text-white">
          Aqyldy quiz
        </Link>
        <Link
          href="/"
          className="rounded-md bg-cyan-600 px-5 py-1.5 text-sm font-semibold text-white transition hover:bg-cyan-700"
        >
          Home
        </Link>
      </header>

      <main className="flex min-h-[calc(100vh-48px)] flex-col items-center justify-center px-6">
        {/* Avatar card */}
        <div className="mb-6 flex flex-col items-center rounded-xl bg-white px-8 pb-4 pt-5 shadow-lg">
          {avatar && (
            <img
              src={avatar}
              alt="Your avatar"
              className="mb-2 h-24 w-24 object-contain"
            />
          )}
          <p className="text-sm font-semibold text-zinc-800">{name}</p>
        </div>

        {/* Edit button */}
        <button
          onClick={handleEdit}
          className="mb-3 h-11 w-52 rounded-lg bg-orange-500 text-base font-bold text-white transition hover:bg-orange-600"
        >
          Edit
        </button>

        {/* Go to game button */}
        <button
          onClick={() => void handleJoin()}
          disabled={loading}
          className="h-11 w-52 rounded-lg bg-orange-500 text-base font-bold text-white transition hover:bg-orange-600 disabled:opacity-50"
        >
          {loading ? "Joining..." : "Go to game"}
        </button>

        {status && (
          <p className="mt-4 text-center text-sm font-medium text-white">{status}</p>
        )}
      </main>
    </div>
  );
}
