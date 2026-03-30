"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  completeSession,
  createSession,
  deleteSession,
  ensureProfile,
  getCurrentUser,
  getLeaderboard,
  getMyQuizzes,
  getQuizQuestions,
  getSession,
  getSessionParticipants,
  removeSubscription,
  setCurrentQuestion,
  subscribeParticipants,
} from "@/src/services/supabase/api";
import { useSessionRealtime } from "@/src/hooks/useSessionRealtime";
import { useSessionStore } from "@/src/store/sessionStore";
import { isSupabaseConfigured } from "@/src/services/supabase/client";
import type { Question, Quiz, Session, SessionParticipant } from "@/src/types/models";

export function HostPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryQuizId = searchParams.get("quiz");
  const querySessionId = searchParams.get("session");

  const [hostId, setHostId] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState(queryQuizId ?? "");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [questionIndex, setQuestionIndex] = useState(-1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setLeaderboard = useSessionStore((s) => s.setLeaderboard);

  const selectedQuiz = useMemo(
    () => quizzes.find((q) => q.id === selectedQuizId) ?? null,
    [quizzes, selectedQuizId],
  );

  useSessionRealtime({
    sessionId: session?.id ?? null,
    onSessionUpdate: (s) => setSession(s),
    onResponseInsert: () => {
      if (session?.id) void getLeaderboard(session.id).then(setLeaderboard);
    },
  });

  useEffect(() => {
    if (!session?.id) return;
    const channel = subscribeParticipants(session.id, (p) => {
      setParticipants((prev) => [...prev, p]);
    });
    return () => removeSubscription(channel);
  }, [session?.id]);

  useEffect(() => {
    if (!session) return;
    timerRef.current = setInterval(() => {
      setWaitSeconds((s) => s + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const onBeforeUnload = () => {
      void deleteSession(session.id);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [session]);

  useEffect(() => {
    async function init() {
      if (!isSupabaseConfigured) {
        setStatus("Configure Supabase ENV first.");
        return;
      }
      const user = await getCurrentUser();
      if (!user) {
        router.replace("/signin?next=/host");
        return;
      }
      await ensureProfile(user, user.email?.split("@")[0] ?? "host");
      setHostId(user.id);
      const rows = await getMyQuizzes(user.id);
      setQuizzes(rows);
      if (!selectedQuizId && rows[0]) {
        setSelectedQuizId(rows[0].id);
      }

      if (querySessionId) {
        const existing = await getSession(querySessionId);
        if (existing && existing.status === "active") {
          setSession(existing);
          setSelectedQuizId(existing.quiz_id);
          const q = await getQuizQuestions(existing.quiz_id);
          setQuestions(q);
          const p = await getSessionParticipants(existing.id);
          setParticipants(p);
        }
      }
    }
    void init();
  }, [router, selectedQuizId, querySessionId]);

  useEffect(() => {
    if (!selectedQuizId) {
      setQuestions([]);
      return;
    }
    void getQuizQuestions(selectedQuizId).then(setQuestions);
  }, [selectedQuizId]);

  const currentQuestion = questions[questionIndex] ?? null;

  async function handleStartSession() {
    if (!selectedQuizId || !hostId) return;
    setLoading(true);
    setStatus("");
    try {
      const created = await createSession(selectedQuizId, hostId);
      setSession(created);
      setQuestionIndex(-1);
      setParticipants([]);
      setWaitSeconds(0);
      setLeaderboard([]);
      const existing = await getSessionParticipants(created.id);
      setParticipants(existing);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleNextQuestion() {
    if (!session) return;
    const nextIdx = questionIndex + 1;
    const next = questions[nextIdx];
    if (!next) {
      setStatus("No more questions.");
      return;
    }
    await setCurrentQuestion(session.id, next.id);
    setQuestionIndex(nextIdx);
  }

  async function handleEnd() {
    if (!session) return;
    await completeSession(session.id);
    if (timerRef.current) clearInterval(timerRef.current);
    setStatus("Session completed.");
  }

  async function handleLeave(destination: string) {
    if (timerRef.current) clearInterval(timerRef.current);
    if (session) {
      try {
        await deleteSession(session.id);
      } catch {
        // best-effort cleanup
      }
    }
    router.push(destination);
  }

  const copyCode = useCallback(() => {
    if (session?.code) {
      void navigator.clipboard.writeText(session.code);
      setStatus("Code copied!");
      setTimeout(() => setStatus(""), 2000);
    }
  }, [session?.code]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // Pre-session: quiz selector
  if (!session) {
    return (
      <div className="flex min-h-screen flex-col bg-cyan-500">
        <header className="flex items-center justify-between bg-orange-500 px-6 py-2.5">
          <span className="text-xl font-bold text-white">Aqyldy quiz</span>
          <Link
            href="/home"
            className="rounded-md bg-cyan-600 px-5 py-1.5 text-sm font-semibold text-white transition hover:bg-cyan-700"
          >
            Home
          </Link>
        </header>
        <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6">
          <h1 className="text-2xl font-bold text-white">Host a Quiz</h1>
          <select
            className="w-64 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm"
            value={selectedQuizId}
            onChange={(e) => setSelectedQuizId(e.target.value)}
          >
            <option value="">Select quiz</option>
            {quizzes.map((q) => (
              <option key={q.id} value={q.id}>
                {q.title}
              </option>
            ))}
          </select>
          <p className="text-sm text-white/80">
            {questions.length} question{questions.length !== 1 ? "s" : ""} loaded
          </p>
          <button
            onClick={handleStartSession}
            disabled={loading || !selectedQuizId || questions.length === 0}
            className="rounded-lg bg-orange-500 px-8 py-3 text-lg font-bold text-white transition hover:bg-orange-600 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Session"}
          </button>
          {status && <p className="text-sm font-medium text-white">{status}</p>}
        </main>
      </div>
    );
  }

  // Active session: lobby / game view
  return (
    <div className="min-h-screen bg-[#27b8c9]">
      <header className="flex items-center justify-between bg-orange-500 px-7 py-3">
        <button
          onClick={() => void handleLeave("/")}
          className="text-[24px] font-bold text-white transition hover:opacity-80"
        >
          Aqyldy quiz
        </button>

        <button
          onClick={() => void handleLeave("/home")}
          className="rounded-xl bg-cyan-500 px-8 py-2 text-base font-bold text-white transition hover:bg-cyan-600"
        >
          Home
        </button>
      </header>
  
      <main className="flex min-h-[calc(100vh-72px)] px-10 py-8">
        {/* LEFT EMPTY SPACE + CENTER CONTENT */}
        <div className="flex flex-1 flex-col items-center">
          {/* GAME CODE CARD */}
          <div className="relative mb-8 w-full max-w-[525px] rounded-xl bg-[#efefef] px-8 py-7 text-center shadow-md">
            <button
              onClick={copyCode}
              className="absolute right-4 top-4 rounded-xl bg-orange-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-orange-600"
            >
              Copy link
            </button>
  
            <p className="text-[28px] leading-none text-black">Game CODE</p>
            <p className="mt-4 text-[86px] font-normal leading-none text-black">
              {session.code}
            </p>
          </div>
  
          {/* QUIZ TITLE */}
          <h2 className="mb-14 text-center text-[38px] font-extrabold text-white">
            {selectedQuiz?.title ?? "Quiz"}
          </h2>
  
          {/* PARTICIPANTS */}
          <div className="flex flex-wrap justify-center gap-6">
            {participants.map((p) => (
              <div
                key={p.id}
                className="flex w-[110px] flex-col items-center bg-[#efefef] px-3 py-3"
              >
                <div className="flex h-[74px] w-[74px] items-center justify-center">
                  {p.avatar_url ? (
                    <img
                      src={p.avatar_url}
                      alt={p.nickname}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                  )}
                </div>
                <span className="mt-3 text-center text-[14px] font-bold text-black">
                  {p.nickname}
                </span>
              </div>
            ))}
          </div>
  
          {participants.length === 0 && (
            <p className="mt-3 text-lg text-white/90">Waiting for players to join...</p>
          )}
        </div>
  
        {/* RIGHT PANEL */}
        <div className="flex w-[250px] shrink-0 flex-col items-center justify-center gap-12">
          {questionIndex < 0 ? (
            <button
              onClick={handleNextQuestion}
              disabled={participants.length === 0}
              className="w-[150px] rounded-xl bg-orange-500 py-4 text-[22px] font-bold text-white transition hover:bg-orange-600 disabled:opacity-50"
            >
              Start
            </button>
          ) : (
            <div className="flex w-full flex-col items-center gap-4">
              <button
                onClick={handleNextQuestion}
                className="w-[170px] rounded-xl bg-orange-500 py-3 text-base font-bold text-white transition hover:bg-orange-600"
              >
                Next question
              </button>
  
              <button
                onClick={handleEnd}
                className="w-[170px] rounded-xl bg-red-500 py-3 text-base font-bold text-white transition hover:bg-red-600"
              >
                End session
              </button>
            </div>
          )}
  
          <div className="text-center">
            <p className="text-[24px] font-bold text-white">Participants</p>
            <p className="mt-1 text-[58px] font-bold leading-none text-white">
              {participants.length}
            </p>
          </div>
  
          <div className="text-center">
            <p className="text-[24px] font-bold text-white">Waiting</p>
            <p className="mt-1 text-[58px] font-bold leading-none text-white">
              {formatTime(waitSeconds)}
            </p>
          </div>
  
          {status && (
            <p className="max-w-[180px] text-center text-sm font-medium text-white">
              {status}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
