"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import {
  SiteHeader,
  SiteHeaderActionLink,
} from "@/src/components/layout/SiteHeader";
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
  const [lastDelta, setLastDelta] = useState(0);

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
      if (!s.current_question && prevQRef.current) {
        prevQRef.current = null;
        return;
      }
      if (s.current_question && s.current_question !== prevQRef.current) {
        prevQRef.current = s.current_question;
        void loadQuestion(s.current_question).then(() => {
          setPhase("countdown");
          setCdVal(3);
          setSelectedAnswerId(null);
          setLastDelta(0);
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
    const tl = question.time_limit ?? 30;
    const timeRatio = tl > 0 ? 1 - ansTimer / tl : 1;
    try {
      const delta = await submitResponse(sessionId, participantId, question.id, answerId, timeRatio);
      setLastDelta(delta);
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
    <SiteHeader right={<SiteHeaderActionLink href="/">Home</SiteHeaderActionLink>} />
  );

  /* ---- LOBBY ---- */
  if (phase === "lobby") {
    return (
      <div className="min-h-screen bg-background">
        {headerBar}
        <main className="flex min-h-[calc(100vh-3.25rem)] px-10 py-8">
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
                  className="flex min-w-[110px] max-w-[160px] flex-col items-center bg-[#efefef] px-3 py-3"
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
                  <span className="mt-3 w-full break-words text-center text-[14px] font-bold text-black">
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
      <div className="flex min-h-screen flex-col bg-background">
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
      <div className="flex min-h-screen flex-col bg-background">
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
  if (phase === "results" && question) {
    const answered = hasSubmitted;
    const wasCorrect = selectedAnswerId
      ? (answers.find((a) => a.id === selectedAnswerId)?.is_correct ?? false)
      : false;

    const overlayBg = !answered
      ? "bg-zinc-500"
      : wasCorrect
        ? "bg-green-500"
        : "bg-red-500";
    const overlayText = !answered
      ? "Time's up!"
      : wasCorrect
        ? "Correct"
        : "Incorrect";

    return (
      <div className="flex min-h-screen flex-col bg-background">
        {headerBar}
        <main className="flex flex-1 flex-col gap-4 p-6">
          {/* Top row */}
          <div className="flex w-full items-start justify-between gap-4">
            <div className="flex items-center gap-2 rounded-lg bg-cyan-600/50 px-4 py-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              <span className="text-base font-bold text-white">
                {participants.length}
              </span>
            </div>

            <div className="flex min-w-0 flex-1 flex-col items-center px-4">
              <div className="w-full max-w-2xl rounded-xl bg-white px-6 py-4 text-center shadow-lg">
                <p className="text-xl font-bold text-zinc-800">
                  {question.text}
                </p>
              </div>
            </div>

            <span className="rounded-lg bg-cyan-600/50 px-4 py-2 text-sm font-bold text-white">
              Results
            </span>
          </div>

          {/* Image with result overlay on top */}
          <div className="relative flex justify-center">
            {question.image_url && (
              <img
                src={question.image_url}
                alt=""
                className="rounded-xl"
                style={{ maxWidth: 746, maxHeight: 465, objectFit: "contain" }}
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`rounded-2xl ${overlayBg} px-12 py-6 text-center shadow-2xl`}>
                <p className="text-3xl font-bold text-white">{overlayText}</p>
                {answered && (
                  <p className="text-xl font-bold text-white">
                    {lastDelta >= 0 ? `+${lastDelta}` : `${lastDelta}`} pts
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Answer grid with correct/wrong indicators */}
          <div className="mx-auto mt-auto grid w-full max-w-4xl grid-cols-2 gap-4 pb-2">
            {answers.map((a, i) => {
              const isCorrectAnswer = a.is_correct;
              const isUserPick = a.id === selectedAnswerId;
              let bg: string;
              let ring = "";
              if (isCorrectAnswer) {
                bg = ANSWER_BG[i % 4];
                ring = "ring-4 ring-green-400";
              } else if (isUserPick) {
                bg = ANSWER_BG[i % 4];
                ring = "ring-4 ring-red-400";
              } else {
                bg = "bg-zinc-400/60";
              }
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-4 rounded-xl px-5 py-4 text-lg font-bold text-white ${bg} ${ring}`}
                >
                  <span className="shrink-0 text-2xl text-white/90">
                    {ANSWER_SHAPES[i % 4]}
                  </span>
                  <span className="flex-1">{a.text}</span>
                  <span className="text-xl">
                    {isCorrectAnswer ? "✓" : "✗"}
                  </span>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  /* ---- SCOREBOARD ---- */
  if (phase === "scoreboard") {
    const top5 = leaderboard.slice(0, 5);
    return (
      <div className="min-h-screen bg-background">
        {headerBar}
        <main className="mx-auto flex w-full max-w-[1280px] flex-col items-center px-6 pt-9">
          <div className="mb-10 w-full max-w-[650px] rounded-[10px] bg-[#f2f2f2] py-5 text-center shadow-md">
            <h2 className="text-[30px] font-medium text-[#1f1f1f]">Scoreboard</h2>
          </div>

          <div className="w-full max-w-[1220px]">
            {top5.map((e, i) => (
              <div
                key={e.id}
                className={`mb-4 flex min-h-[86px] items-center px-4 shadow-md ${
                  i === 0 ? "bg-[#f3f3f3]" : "bg-[#5b9faa]"
                }`}
              >
                <div className="mr-4 h-[60px] w-[60px] shrink-0 overflow-hidden rounded-full bg-[#d9d9d9]">
                  {e.avatar_url ? (
                    <img src={e.avatar_url} alt={e.nickname} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className={`flex-1 text-[28px] font-bold leading-none drop-shadow-sm ${
                  i === 0 ? "text-[#4a4a4a]" : "text-white"
                }`}>
                  {e.nickname}
                </div>
                <div className={`pr-12 text-[28px] font-bold leading-none drop-shadow-sm ${
                  i === 0 ? "text-[#4a4a4a]" : "text-white"
                }`}>
                  {e.score}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-4 text-sm text-white/70">Waiting for host...</p>
        </main>
      </div>
    );
  }

  /* ---- FINAL LEADERBOARD ---- */
  if (phase === "finalLeaderboard") {
    const top3 = leaderboard.slice(0, 3);
    const podiumOrder = [top3[1], top3[0], top3[2]];
    const podiumConfig = [
      { place: 2, medal: "/places/silver_2.png", height: "h-[345px]", width: "w-[265px]", medalSize: "h-[108px] w-[108px]", avatarSize: "h-[112px] w-[112px]" },
      { place: 1, medal: "/places/gold 1.png", height: "h-[445px]", width: "w-[265px]", medalSize: "h-[92px] w-[92px]", avatarSize: "h-[142px] w-[142px]" },
      { place: 3, medal: "/places/bronze_3.png", height: "h-[270px]", width: "w-[265px]", medalSize: "h-[108px] w-[108px]", avatarSize: "h-[112px] w-[112px]" },
    ];

    const me = participantId ? leaderboard.find((p) => p.id === participantId) : null;
    const myRank = me ? leaderboard.findIndex((p) => p.id === participantId) + 1 : null;

    return (
      <div className="min-h-screen bg-background">
        {headerBar}
        <main className="mx-auto flex w-full max-w-[1400px] flex-col items-center px-0 pt-2">

          <div className="mb-8 w-full max-w-[1070px] rounded-[12px] bg-[#f2f2f2] py-5 text-center shadow-md">
            <h2 className="text-[30px] font-medium text-[#1f1f1f]">Quiz Complete</h2>
          </div>

          {me && myRank && (
            <div className="mb-8 rounded-[12px] bg-[#f2f2f2] px-14 py-3 text-center shadow-md">
              <p className="text-[24px] font-medium text-[#1f1f1f]">
                You&apos;re in {myRank === 1 ? "1st" : myRank === 2 ? "2nd" : myRank === 3 ? "3rd" : `${myRank}th`} place with {me.score} points!
              </p>
            </div>
          )}

          <div className="mb-[30px] flex w-full items-end justify-center gap-5">
            {podiumOrder.map((entry, i) => {
              const cfg = podiumConfig[i];
              if (!entry) return <div key={i} className={cfg.width} />;
              return (
                <div key={entry.id} className="flex flex-col items-center">
                  <div className="mb-3 rounded-[10px] bg-[#f2f2f2] px-8 py-2.5 shadow-md">
                    <p className="text-[22px] font-medium text-[#1f1f1f]">{entry.nickname}</p>
                  </div>
                  <div className={`flex ${cfg.width} ${cfg.height} flex-col items-center bg-[#5b9faa] px-6 pt-6 shadow-[8px_8px_0_rgba(0,0,0,0.08)]`}>
                    <div className={`mb-5 overflow-hidden bg-white ${cfg.avatarSize}`}>
                      {entry.avatar_url ? (
                        <img src={entry.avatar_url} alt={entry.nickname} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[#e5e5e5] text-3xl font-bold text-zinc-500">
                          {entry.nickname?.[0]?.toUpperCase() ?? "?"}
                        </div>
                      )}
                    </div>
                    <img src={cfg.medal} alt={`Place ${cfg.place}`} className={`${cfg.medalSize} object-contain`} />
                    <p className="mt-5 text-[32px] font-bold leading-none text-white drop-shadow-sm">{entry.score}</p>  
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  return null;
}
