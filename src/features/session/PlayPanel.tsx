"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
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
import CountdownBar from "@/src/components/ui/CountdownBar";
import type { Answer, Question, Session, SessionParticipant } from "@/src/types/models";

type GamePhase =
  | "lobby"
  | "countdown"
  | "answering"
  | "results"
  | "scoreboard"
  | "finalLeaderboard";

const ANSWER_BG = ["bg-red-500", "bg-blue-500", "bg-yellow-500", "bg-green-500"];
const ANSWER_SHAPES = ["▲", "◆", "●", "■"];

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
  const [submittedQuestions, setSubmittedQuestions] = useState<
    Record<string, boolean>
  >({});
  const [status, setStatus] = useState("");
  const [waitSeconds, setWaitSeconds] = useState(0);

  const [phase, setPhase] = useState<GamePhase>("lobby");
  const [cdVal, setCdVal] = useState(3);
  const [ansTimer, setAnsTimer] = useState(0);

  const leaderboard = useSessionStore((s) => s.leaderboard);
  const setLeaderboard = useSessionStore((s) => s.setLeaderboard);

  const prevQRef = useRef<string | null>(null);

  const hasSubmitted = question
    ? (submittedQuestions[question.id] ?? false)
    : false;

  /* ---- Load question data ---- */

  const loadQuestion = useCallback(
    async (questionId: string | null) => {
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
    },
    [],
  );

  /* ---- Realtime ---- */

  const handleSessUpdate = useCallback(
    (s: Session) => {
      setSession(s);
      if (s.status === "completed") {
        if (sessionId) void getLeaderboard(sessionId).then(setLeaderboard);
        setPhase("finalLeaderboard");
        return;
      }
      if (s.current_question && s.current_question !== prevQRef.current) {
        prevQRef.current = s.current_question;
        void loadQuestion(s.current_question).then(() => {
          setPhase("countdown");
          setCdVal(3);
          setSelectedAnswerId(null);
        });
      }
    },
    [sessionId, setLeaderboard, loadQuestion],
  );

  const handleRespInsert = useCallback(() => {
    if (sessionId) void getLeaderboard(sessionId).then(setLeaderboard);
  }, [sessionId, setLeaderboard]);

  useSessionRealtime({
    sessionId,
    onSessionUpdate: handleSessUpdate,
    onResponseInsert: handleRespInsert,
  });

  useEffect(() => {
    if (!sessionId) return;
    const ch = subscribeParticipants(sessionId, (p) =>
      setParticipants((prev) => [...prev, p]),
    );
    return () => removeSubscription(ch);
  }, [sessionId]);

  /* ---- Init ---- */

  useEffect(() => {
    async function init() {
      if (!sessionId || !participantId) {
        router.replace("/join");
        return;
      }
      const s = await getSession(sessionId);
      setSession(s);
      if (s.status === "completed") {
        setLeaderboard(await getLeaderboard(sessionId));
        setPhase("finalLeaderboard");
        return;
      }
      if (s.current_question) {
        prevQRef.current = s.current_question;
        await loadQuestion(s.current_question);
        setPhase("countdown");
        setCdVal(3);
      }
      setLeaderboard(await getLeaderboard(sessionId));
      setParticipants(await getSessionParticipants(sessionId));
    }
    void init();
  }, [loadQuestion, participantId, router, sessionId, setLeaderboard]);

  /* ---- Lobby timer ---- */

  useEffect(() => {
    if (phase !== "lobby") return;
    const t = setInterval(() => setWaitSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  /* ---- Phase timers ---- */

  useEffect(() => {
    if (phase !== "countdown") return;
    if (cdVal <= 0) {
      setPhase("answering");
      setAnsTimer(question?.time_limit ?? 30);
      return;
    }
    const t = setTimeout(() => setCdVal((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, cdVal, question?.time_limit]);

  useEffect(() => {
    if (phase !== "answering") return;
    if (ansTimer <= 0) {
      setPhase("results");
      return;
    }
    const t = setTimeout(() => setAnsTimer((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, ansTimer]);

  useEffect(() => {
    if (phase !== "results" || !sessionId) return;
    const t = setTimeout(() => {
      void getLeaderboard(sessionId).then((b) => {
        setLeaderboard(b);
        setPhase("scoreboard");
      });
    }, 4000);
    return () => clearTimeout(t);
  }, [phase, sessionId, setLeaderboard]);

  /* ---- Actions ---- */

  async function handlePickAnswer(answerId: string) {
    if (hasSubmitted || !sessionId || !participantId || !question) return;
    setSelectedAnswerId(answerId);
    try {
      await submitResponse(sessionId, participantId, question.id, answerId);
      setSubmittedQuestions((c) => ({ ...c, [question.id]: true }));
    } catch (e) {
      setStatus((e as Error).message);
    }
  }

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, "0")}`;
  };

  /* ===================== RENDERING ===================== */

  const headerBar = (
    <header className="flex items-center justify-between bg-orange-500 px-7 py-3">
      <span className="text-2xl font-bold text-white">Aqyldy quiz</span>
      <Link
        href="/"
        className="rounded-xl bg-cyan-500 px-8 py-2 font-bold text-white transition hover:bg-cyan-600"
      >
        Home
      </Link>
    </header>
  );

  /* ---- LOBBY ---- */
  if (phase === "lobby") {
    return (
      <div className="min-h-screen bg-[#27b8c9]">
        {headerBar}
        <main className="flex min-h-[calc(100vh-72px)] px-10 py-8">
          <div className="flex flex-1 flex-col items-center">
            <div className="relative mb-8 w-full max-w-[525px] rounded-xl bg-[#efefef] px-8 py-7 text-center shadow-md">
              <p className="text-[28px] leading-none text-black">Game CODE</p>
              <p className="mt-4 text-[86px] font-normal leading-none text-black">
                {session?.code ?? "..."}
              </p>
            </div>
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
                      <svg
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#0891b2"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                        />
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
              <p className="mt-3 text-lg text-white/90">
                Waiting for players to join...
              </p>
            )}
          </div>
          <div className="flex w-[250px] shrink-0 flex-col items-center justify-center gap-12">
            <div className="text-center">
              <p className="text-[22px] font-bold text-white">Participants</p>
              <p className="text-[64px] font-extrabold leading-none text-white">
                {participants.length}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[22px] font-bold text-white">Waiting</p>
              <p className="text-[64px] font-extrabold leading-none text-white">
                {fmtTime(waitSeconds)}
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  /* ---- COUNTDOWN ---- */
  if (phase === "countdown" && question) {
    return (
      <div className="flex min-h-screen flex-col bg-[#27b8c9]">
        {headerBar}
        <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
          <span className="rounded-full bg-orange-500 px-6 py-2 text-lg font-bold text-white">
            Get Ready!
          </span>
          <div className="w-full max-w-2xl rounded-2xl bg-white px-8 py-6 text-center shadow-xl">
            <p className="text-xl font-bold text-zinc-800">{question.text}</p>
          </div>
          {question.image_url && (
            <img
              src={question.image_url}
              alt=""
              className="rounded-xl"
              style={{ maxWidth: 746, maxHeight: 465, objectFit: "contain" }}
            />
          )}
          <CountdownBar key={question.id} duration={3000} />
        </main>
      </div>
    );
  }

  /* ---- ANSWERING ---- */
  if (phase === "answering" && question) {
    const tl = question.time_limit ?? 30;
    const remainPct = tl > 0 ? (ansTimer / tl) * 100 : 0;

    return (
      <div className="flex min-h-screen flex-col bg-[#27b8c9]">
        {headerBar}
        <main className="flex flex-1 flex-col gap-4 p-6">
          {/* Top row */}
          <div className="flex w-full items-start justify-between gap-4">
            {/* Left: participant count */}
            <div className="flex items-center gap-2 rounded-lg bg-cyan-600/50 px-4 py-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              <span className="text-base font-bold text-white">
                {participants.length}
              </span>
            </div>

            {/* Center: question card + progress bar */}
            <div className="flex min-w-0 flex-1 flex-col items-center px-4">
              <div className="w-full max-w-2xl rounded-xl bg-white px-6 py-4 text-center shadow-lg">
                <p className="text-xl font-bold text-zinc-800">
                  {question.text}
                </p>
              </div>
              <div className="mt-2 h-2 w-full max-w-2xl overflow-hidden rounded-full bg-white/30">
                <div
                  className="h-full rounded-full bg-orange-500 transition-all duration-1000 ease-linear"
                  style={{ width: `${remainPct}%` }}
                />
              </div>
            </div>

            {/* Right: question badge + timer */}
            <div className="flex flex-col items-end gap-2">
              <span className="rounded-lg bg-cyan-600/50 px-4 py-2 text-sm font-bold text-white">
                Get Ready!
              </span>
              <span className="rounded-lg bg-cyan-600/50 px-5 py-2 text-lg font-bold text-white tabular-nums">
                {fmtTime(ansTimer)}
              </span>
            </div>
          </div>

          {/* Image */}
          {question.image_url && (
            <div className="flex justify-center">
              <img
                src={question.image_url}
                alt=""
                className="rounded-xl"
                style={{ maxWidth: 746, maxHeight: 465, objectFit: "contain" }}
              />
            </div>
          )}

          {/* Answer grid / submitted state */}
          {hasSubmitted ? (
            <div className="mx-auto mt-auto w-full max-w-4xl rounded-xl bg-white/20 py-8 text-center">
              <p className="text-xl font-bold text-white">
                Answer submitted!
              </p>
              <p className="mt-2 text-sm text-white/80">
                Waiting for others...
              </p>
            </div>
          ) : (
            <div className="mx-auto mt-auto grid w-full max-w-4xl grid-cols-2 gap-4 pb-2">
              {answers.map((a, i) => (
                <button
                  key={a.id}
                  onClick={() => void handlePickAnswer(a.id)}
                  className={clsx(
                    "flex items-center gap-4 rounded-xl px-5 py-4 text-lg font-bold text-white shadow-md transition",
                    selectedAnswerId === a.id && "ring-4 ring-white",
                    ANSWER_BG[i % 4],
                  )}
                >
                  <span className="shrink-0 text-2xl text-white/90">
                    {ANSWER_SHAPES[i % 4]}
                  </span>
                  <span>{a.text}</span>
                </button>
              ))}
            </div>
          )}

          {status && (
            <p className="text-sm font-medium text-white">{status}</p>
          )}
        </main>
      </div>
    );
  }

  /* ---- RESULTS ---- */
  if (phase === "results") {
    const answered = hasSubmitted;
    const wasCorrect = selectedAnswerId
      ? (answers.find((a) => a.id === selectedAnswerId)?.is_correct ?? false)
      : false;

    return (
      <div className="flex min-h-screen flex-col bg-[#27b8c9]">
        {headerBar}
        <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
          {answered ? (
            wasCorrect ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-500 shadow-lg">
                  <span className="text-5xl text-white">&#10003;</span>
                </div>
                <p className="text-3xl font-bold text-white">Correct!</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-500 shadow-lg">
                  <span className="text-5xl text-white">&#10007;</span>
                </div>
                <p className="text-3xl font-bold text-white">Incorrect</p>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-zinc-500 shadow-lg">
                <span className="text-4xl text-white">!</span>
              </div>
              <p className="text-3xl font-bold text-white">Time&apos;s up!</p>
            </div>
          )}
        </main>
      </div>
    );
  }

  /* ---- SCOREBOARD ---- */
  if (phase === "scoreboard") {
    const top5 = leaderboard.slice(0, 5);
    return (
      <div className="flex min-h-screen flex-col bg-[#27b8c9]">
        {headerBar}
        <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
          <h2 className="text-3xl font-bold text-white">Scoreboard</h2>
          <div className="w-full max-w-lg space-y-3">
            {top5.map((e, i) => (
              <div
                key={e.id}
                className="flex items-center gap-4 rounded-xl bg-white px-5 py-3 shadow-lg"
              >
                <span className="w-8 text-2xl font-bold text-zinc-400">
                  {i + 1}
                </span>
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-zinc-100">
                  {e.avatar_url ? (
                    <img
                      src={e.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                      ?
                    </div>
                  )}
                </div>
                <span className="flex-1 font-bold text-zinc-800">
                  {e.nickname}
                </span>
                <span className="font-bold text-orange-500">
                  {e.score} pts
                </span>
              </div>
            ))}
          </div>
          <p className="text-sm text-white/70">Waiting for host...</p>
        </main>
      </div>
    );
  }

  /* ---- FINAL LEADERBOARD ---- */
  if (phase === "finalLeaderboard") {
    const top3 = leaderboard.slice(0, 3);
    const podiumOrder = [top3[1], top3[0], top3[2]];
    const podiumH = ["h-24", "h-36", "h-16"];
    const podiumBg = ["bg-gray-300", "bg-yellow-400", "bg-orange-300"];
    const podiumRing = ["", "ring-4 ring-yellow-400", ""];
    const avatarSz = ["h-16 w-16", "h-20 w-20", "h-14 w-14"];
    const ranks = ["2", "1", "3"];
    const rankClr = ["text-zinc-600", "text-yellow-800", "text-orange-700"];
    const nameSz = ["text-base", "text-xl", "text-sm"];

    return (
      <div className="flex min-h-screen flex-col bg-[#27b8c9]">
        {headerBar}
        <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
          <h2 className="text-4xl font-bold text-white">Final Leaderboard</h2>

          <div className="flex items-end gap-4">
            {podiumOrder.map((entry, i) =>
              entry ? (
                <div
                  key={entry.id}
                  className="flex w-32 flex-col items-center"
                >
                  <div
                    className={`overflow-hidden rounded-full bg-zinc-200 ${avatarSz[i]} ${podiumRing[i]}`}
                  >
                    {entry.avatar_url ? (
                      <img
                        src={entry.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-zinc-400">
                        ?
                      </div>
                    )}
                  </div>
                  <p className={`mt-2 font-bold text-white ${nameSz[i]}`}>
                    {entry.nickname}
                  </p>
                  <p className="text-sm text-white/80">{entry.score} pts</p>
                  <div
                    className={`mt-2 flex w-full items-center justify-center rounded-t-xl ${podiumBg[i]} ${podiumH[i]}`}
                  >
                    <span className={`text-3xl font-bold ${rankClr[i]}`}>
                      {ranks[i]}
                    </span>
                  </div>
                </div>
              ) : (
                <div key={i} className="w-32" />
              ),
            )}
          </div>

          <Link
            href="/"
            className="mt-6 rounded-xl bg-orange-500 px-8 py-3 text-lg font-bold text-white transition hover:bg-orange-600"
          >
            Back to Home
          </Link>
        </main>
      </div>
    );
  }

  return null;
}
