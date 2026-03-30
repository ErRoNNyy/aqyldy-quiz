"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import {
  getAnswersForQuestion,
  getLeaderboard,
  getQuestionById,
  getSession,
  getSessionParticipants,
  removeSubscription,
  submitResponse,
  subscribeParticipants,
} from "@/src/services/supabase/api";
import { useSessionRealtime } from "@/src/hooks/useSessionRealtime";
import { useSessionStore } from "@/src/store/sessionStore";
import type { Answer, Question, Session, SessionParticipant } from "@/src/types/models";

const ANSWER_COLORS = ["bg-red-500", "bg-blue-500", "bg-yellow-500", "bg-green-500"];

export function PlayPanel() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("session");
  const participantId = params.get("participant");

  const [session, setSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null);
  const [submittedQuestions, setSubmittedQuestions] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState("");
  const [waitSeconds, setWaitSeconds] = useState(0);

  const leaderboard = useSessionStore((s) => s.leaderboard);
  const setLeaderboard = useSessionStore((s) => s.setLeaderboard);

  const hasSubmitted = useMemo(() => {
    if (!question) return false;
    return submittedQuestions[question.id] ?? false;
  }, [question, submittedQuestions]);

  const loadQuestion = useCallback(async (questionId: string | null) => {
    if (!questionId) {
      setQuestion(null);
      setAnswers([]);
      setSelectedAnswerId(null);
      return;
    }
    const q = await getQuestionById(questionId);
    const a = await getAnswersForQuestion(questionId);
    setQuestion(q);
    setAnswers(a);
    setSelectedAnswerId(null);
  }, []);

  useEffect(() => {
    async function init() {
      if (!sessionId || !participantId) {
        router.replace("/join");
        return;
      }
      const s = await getSession(sessionId);
      setSession(s);
      await loadQuestion(s.current_question);
      const board = await getLeaderboard(sessionId);
      setLeaderboard(board);
      const p = await getSessionParticipants(sessionId);
      setParticipants(p);
    }
    void init();
  }, [loadQuestion, participantId, router, sessionId, setLeaderboard]);

  useSessionRealtime({
    sessionId,
    onSessionUpdate: (s) => {
      setSession(s);
      void loadQuestion(s.current_question);
    },
    onResponseInsert: () => {
      if (sessionId) void getLeaderboard(sessionId).then(setLeaderboard);
    },
  });

  useEffect(() => {
    if (!sessionId) return;
    const channel = subscribeParticipants(sessionId, (p) => {
      setParticipants((prev) => [...prev, p]);
    });
    return () => removeSubscription(channel);
  }, [sessionId]);

  useEffect(() => {
    if (question) return;
    const timer = setInterval(() => setWaitSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [question]);

  async function handleSubmit() {
    if (!sessionId || !participantId || !question || !selectedAnswerId) return;
    try {
      await submitResponse(sessionId, participantId, question.id, selectedAnswerId);
      setSubmittedQuestions((c) => ({ ...c, [question.id]: true }));
      setStatus("Answer submitted!");
    } catch (e) {
      setStatus((e as Error).message);
    }
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // Waiting lobby (no question yet)
  if (!question) {
    return (
      <div className="min-h-screen bg-[#27b8c9]">
        <header className="flex items-center justify-between bg-orange-500 px-7 py-3">
          <span className="text-[24px] font-bold text-white">Aqyldy quiz</span>
          <Link
            href="/"
            className="rounded-xl bg-cyan-500 px-8 py-2 text-base font-bold text-white transition hover:bg-cyan-600"
          >
            Home
          </Link>
        </header>

        <main className="flex min-h-[calc(100vh-72px)] px-10 py-8">
          <div className="flex flex-1 flex-col items-center">
            {/* Game code card */}
            <div className="relative mb-8 w-full max-w-[525px] rounded-xl bg-[#efefef] px-8 py-7 text-center shadow-md">
              <p className="text-[28px] leading-none text-black">Game CODE</p>
              <p className="mt-4 text-[86px] font-normal leading-none text-black">
                {session?.code ?? "..."}
              </p>
            </div>

            {/* Participant avatars */}
            <div className="flex flex-wrap justify-center gap-6">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className="flex w-[110px] flex-col items-center bg-[#efefef] px-3 py-3"
                >
                  <div className="flex h-[74px] w-[74px] items-center justify-center">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt={p.nickname} className="h-full w-full object-contain" />
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

          {/* Right panel - no buttons, info only */}
          <div className="flex w-[250px] shrink-0 flex-col items-center justify-center gap-12">
            <div className="text-center">
              <p className="text-[22px] font-bold text-white">Participants</p>
              <p className="text-[64px] font-extrabold leading-none text-white">{participants.length}</p>
            </div>
            <div className="text-center">
              <p className="text-[22px] font-bold text-white">Waiting</p>
              <p className="text-[64px] font-extrabold leading-none text-white">{formatTime(waitSeconds)}</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Session completed
  if (session?.status === "completed") {
    return (
      <div className="flex min-h-screen flex-col bg-cyan-500">
        <header className="flex items-center justify-between bg-orange-500 px-6 py-2.5">
          <span className="text-xl font-bold text-white">Aqyldy quiz</span>
          <Link
            href="/"
            className="rounded-md bg-cyan-600 px-5 py-1.5 text-sm font-semibold text-white transition hover:bg-cyan-700"
          >
            Home
          </Link>
        </header>
        <main className="flex flex-1 flex-col items-center justify-center px-6">
          <h1 className="mb-6 text-3xl font-bold text-white">Quiz Finished!</h1>
          <div className="w-full max-w-sm space-y-2">
            {leaderboard.map((entry, i) => (
              <div key={entry.id} className="flex items-center justify-between rounded-lg bg-white px-5 py-3 shadow">
                <span className="font-bold text-zinc-800">#{i + 1} {entry.nickname}</span>
                <span className="font-bold text-orange-500">{entry.score} pts</span>
              </div>
            ))}
          </div>
          <Link href="/" className="mt-8 rounded-lg bg-orange-500 px-8 py-3 font-bold text-white hover:bg-orange-600">
            Back to Home
          </Link>
        </main>
      </div>
    );
  }

  // Active question
  return (
    <div className="flex min-h-screen flex-col bg-cyan-500">
      <header className="flex items-center justify-between bg-orange-500 px-6 py-2.5">
        <span className="text-xl font-bold text-white">Aqyldy quiz</span>
        <Link
          href="/"
          className="rounded-md bg-cyan-600 px-5 py-1.5 text-sm font-semibold text-white transition hover:bg-cyan-700"
        >
          Home
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center gap-5 p-6">
        {/* Question text */}
        <div className="w-full max-w-3xl rounded-xl bg-white px-6 py-4 text-center shadow-lg">
          <p className="text-lg font-bold text-zinc-800">{question.text}</p>
        </div>

        {question.image_url && (
          <img
            src={question.image_url}
            alt="Question"
            className="max-h-48 rounded-xl shadow-lg"
          />
        )}

        {hasSubmitted ? (
          <div className="w-full max-w-3xl rounded-xl bg-white/20 py-8 text-center">
            <p className="text-xl font-bold text-white">Answer submitted!</p>
            <p className="mt-2 text-sm text-white/80">Waiting for next question...</p>
          </div>
        ) : (
          <div className="grid w-full max-w-3xl grid-cols-2 gap-4">
            {answers.map((ans, i) => (
              <button
                key={ans.id}
                onClick={() => setSelectedAnswerId(ans.id)}
                className={clsx(
                  "rounded-xl py-5 text-base font-bold text-white shadow-md transition",
                  selectedAnswerId === ans.id
                    ? "ring-4 ring-white"
                    : "",
                  ANSWER_COLORS[i % 4],
                )}
              >
                {ans.text}
              </button>
            ))}
          </div>
        )}

        {!hasSubmitted && selectedAnswerId && (
          <button
            onClick={() => void handleSubmit()}
            className="rounded-xl bg-orange-500 px-10 py-3 text-lg font-bold text-white shadow-lg transition hover:bg-orange-600"
          >
            Submit
          </button>
        )}

        {status && (
          <p className="text-sm font-medium text-white">{status}</p>
        )}
      </main>
    </div>
  );
}
