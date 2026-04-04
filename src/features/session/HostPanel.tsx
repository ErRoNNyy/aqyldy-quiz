"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  completeSession,
  createSession,
  deleteSession,
  ensureProfile,
  getAnswersForQuestion,
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
import type {
  Answer,
  Question,
  Quiz,
  ResponseRow,
  Session,
  SessionParticipant,
} from "@/src/types/models";

type GamePhase =
  | "lobby"
  | "countdown"
  | "answering"
  | "results"
  | "scoreboard"
  | "finalLeaderboard";

const ANSWER_BG = ["bg-red-500", "bg-blue-500", "bg-yellow-500", "bg-green-500"];
const ANSWER_SHAPES = ["▲", "◆", "●", "■"];

export function HostPanel() {
  const router = useRouter();
  const sp = useSearchParams();
  const queryQuizId = sp.get("quiz");
  const querySessionId = sp.get("session");

  const [hostId, setHostId] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState(queryQuizId ?? "");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [qIdx, setQIdx] = useState(-1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [waitSec, setWaitSec] = useState(0);
  const waitRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [phase, setPhase] = useState<GamePhase>("lobby");
  const [cdVal, setCdVal] = useState(3);
  const [ansTimer, setAnsTimer] = useState(0);
  const [respCount, setRespCount] = useState(0);
  const [curAnswers, setCurAnswers] = useState<Answer[]>([]);

  const leaderboard = useSessionStore((s) => s.leaderboard);
  const setLeaderboard = useSessionStore((s) => s.setLeaderboard);

  const selectedQuiz = useMemo(
    () => quizzes.find((q) => q.id === selectedQuizId) ?? null,
    [quizzes, selectedQuizId],
  );

  const curQ = questions[qIdx] ?? null;

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const qIdRef = useRef<string | null>(null);
  qIdRef.current = curQ?.id ?? null;
  const advRef = useRef<() => Promise<void>>(undefined);

  /* ---- Realtime ---- */

  const onSessUpdate = useCallback((s: Session) => setSession(s), []);

  const onRespInsert = useCallback(
    (r: ResponseRow) => {
      const sid = sessionRef.current?.id;
      if (sid) void getLeaderboard(sid).then(setLeaderboard);
      if (r.question_id === qIdRef.current) setRespCount((c) => c + 1);
    },
    [setLeaderboard],
  );

  useSessionRealtime({
    sessionId: session?.id ?? null,
    onSessionUpdate: onSessUpdate,
    onResponseInsert: onRespInsert,
  });

  useEffect(() => {
    if (!session?.id) return;
    const ch = subscribeParticipants(session.id, (p) =>
      setParticipants((prev) => [...prev, p]),
    );
    return () => removeSubscription(ch);
  }, [session?.id]);

  useEffect(() => {
    if (!session || phase !== "lobby") return;
    waitRef.current = setInterval(() => setWaitSec((s) => s + 1), 1000);
    return () => {
      if (waitRef.current) clearInterval(waitRef.current);
    };
  }, [session, phase]);

  useEffect(() => {
    if (!session) return;
    const fn = () => void deleteSession(session.id);
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [session]);

  /* ---- Init ---- */

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
      if (!selectedQuizId && rows[0]) setSelectedQuizId(rows[0].id);
      if (querySessionId) {
        const ex = await getSession(querySessionId);
        if (ex?.status === "active") {
          setSession(ex);
          setSelectedQuizId(ex.quiz_id);
          setQuestions(await getQuizQuestions(ex.quiz_id));
          setParticipants(await getSessionParticipants(ex.id));
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

  /* ---- Phase timers ---- */

  useEffect(() => {
    if (phase !== "countdown") return;
    if (cdVal <= 0) {
      setPhase("answering");
      setAnsTimer(curQ?.time_limit ?? 30);
      setRespCount(0);
      return;
    }
    const t = setTimeout(() => setCdVal((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, cdVal, curQ?.time_limit]);

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
    if (phase !== "results" || !session) return;
    const t = setTimeout(() => {
      void getLeaderboard(session.id).then((b) => {
        setLeaderboard(b);
        setPhase("scoreboard");
      });
    }, 4000);
    return () => clearTimeout(t);
  }, [phase, session, setLeaderboard]);

  useEffect(() => {
    if (phase !== "scoreboard") return;
    const t = setTimeout(() => void advRef.current?.(), 8000);
    return () => clearTimeout(t);
  }, [phase]);

  /* ---- Actions ---- */

  async function handleCreateSession() {
    if (!selectedQuizId || !hostId) return;
    setLoading(true);
    setStatus("");
    try {
      const created = await createSession(selectedQuizId, hostId);
      setSession(created);
      setQIdx(-1);
      setParticipants(await getSessionParticipants(created.id));
      setWaitSec(0);
      setLeaderboard([]);
      setPhase("lobby");
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function startGame() {
    if (!session || questions.length === 0) return;
    await setCurrentQuestion(session.id, questions[0].id);
    const ans = await getAnswersForQuestion(questions[0].id);
    setQIdx(0);
    setCurAnswers(ans);
    setPhase("countdown");
    setCdVal(3);
    if (waitRef.current) clearInterval(waitRef.current);
  }

  function handleSkip() {
    setPhase("results");
  }

  async function advance() {
    if (!session) return;
    const next = qIdx + 1;
    if (next >= questions.length) {
      await completeSession(session.id);
      setLeaderboard(await getLeaderboard(session.id));
      setPhase("finalLeaderboard");
    } else {
      await setCurrentQuestion(session.id, questions[next].id);
      const ans = await getAnswersForQuestion(questions[next].id);
      setQIdx(next);
      setCurAnswers(ans);
      setPhase("countdown");
      setCdVal(3);
      setRespCount(0);
    }
  }
  advRef.current = advance;

  async function handleLeave(dest: string) {
    if (waitRef.current) clearInterval(waitRef.current);
    if (session) {
      try {
        await deleteSession(session.id);
      } catch {
        /* best-effort */
      }
    }
    router.push(dest);
  }

  const copyCode = useCallback(() => {
    if (session?.code) {
      void navigator.clipboard.writeText(session.code);
      setStatus("Code copied!");
      setTimeout(() => setStatus(""), 2000);
    }
  }, [session?.code]);

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, "0")}`;
  };

  /* ===================== RENDERING ===================== */

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
            onClick={handleCreateSession}
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

  const header = (
    <header className="flex items-center justify-between bg-orange-500 px-7 py-3">
      <button
        onClick={() => void handleLeave("/")}
        className="text-2xl font-bold text-white transition hover:opacity-80"
      >
        Aqyldy quiz
      </button>
      <button
        onClick={() => void handleLeave("/home")}
        className="rounded-xl bg-cyan-500 px-8 py-2 font-bold text-white transition hover:bg-cyan-600"
      >
        Home
      </button>
    </header>
  );

  /* ---- LOBBY ---- */
  if (phase === "lobby") {
    return (
      <div className="min-h-screen bg-[#27b8c9]">
        {header}
        <main className="flex min-h-[calc(100vh-72px)] px-10 py-8">
          <div className="flex flex-1 flex-col items-center">
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
            <h2 className="mb-14 text-center text-[38px] font-extrabold text-white">
              {selectedQuiz?.title ?? "Quiz"}
            </h2>
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
            <button
              onClick={() => void startGame()}
              disabled={participants.length === 0 || questions.length === 0}
              className="w-[150px] rounded-xl bg-orange-500 py-4 text-[22px] font-bold text-white transition hover:bg-orange-600 disabled:opacity-50"
            >
              Start
            </button>
            <div className="text-center">
              <p className="text-[24px] font-bold text-white">Participants</p>
              <p className="mt-1 text-[58px] font-bold leading-none text-white">
                {participants.length}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[24px] font-bold text-white">Waiting</p>
              <p className="mt-1 text-[58px] font-bold leading-none text-white">
                {fmtTime(waitSec)}
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

  /* ---- COUNTDOWN ---- */
  if (phase === "countdown" && curQ) {
    const pct = (cdVal / 3) * 100;
    return (
      <div className="flex min-h-screen flex-col bg-[#27b8c9]">
        {header}
        <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
          <span className="rounded-full bg-orange-500 px-6 py-2 text-lg font-bold text-white">
            Question {qIdx + 1} of {questions.length}
          </span>
          <div className="w-full max-w-2xl rounded-2xl bg-white px-8 py-6 text-center shadow-xl">
            <p className="text-xl font-bold text-zinc-800">{curQ.text}</p>
          </div>
          {curQ.image_url && (
            <img
              src={curQ.image_url}
              alt=""
              className="max-h-48 rounded-xl shadow-lg"
            />
          )}
          <p className="text-[120px] font-black leading-none text-white drop-shadow-lg">
            {cdVal}
          </p>
          <div className="w-full max-w-xl overflow-hidden rounded-full bg-white/30">
            <div
              className="h-3 rounded-full bg-orange-500 transition-all duration-1000 ease-linear"
              style={{ width: `${pct}%` }}
            />
          </div>
        </main>
      </div>
    );
  }

  /* ---- ANSWERING ---- */
  if (phase === "answering" && curQ) {
    const tl = curQ.time_limit ?? 30;
    const remainPct = tl > 0 ? (ansTimer / tl) * 100 : 0;

    return (
      <div className="flex min-h-screen flex-col bg-[#27b8c9]">
        {header}
        <main className="flex flex-1 flex-col gap-4 p-6">
          {/* Top row */}
          <div className="flex w-full items-start justify-between gap-4">
            {/* Left: participant count + skip */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 rounded-lg bg-cyan-600/50 px-4 py-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
                <span className="text-base font-bold text-white">
                  {respCount}/{participants.length}
                </span>
              </div>
              <button
                onClick={handleSkip}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-orange-600"
              >
                Skip &rarr;
              </button>
            </div>

            {/* Center: question card + progress bar */}
            <div className="flex min-w-0 flex-1 flex-col items-center px-4">
              <div className="w-full max-w-2xl rounded-xl bg-white px-6 py-4 text-center shadow-lg">
                <p className="text-xl font-bold text-zinc-800">{curQ.text}</p>
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
                Question {qIdx + 1} of {questions.length}
              </span>
              <span className="rounded-lg bg-cyan-600/50 px-5 py-2 text-lg font-bold text-white tabular-nums">
                {fmtTime(ansTimer)}
              </span>
            </div>
          </div>

          {/* Image */}
          {curQ.image_url && (
            <div className="flex justify-center">
              <img
                src={curQ.image_url}
                alt=""
                className="rounded-xl"
                style={{ maxWidth: 746, maxHeight: 465, objectFit: "contain" }}
              />
            </div>
          )}

          {/* Answer grid pinned to bottom */}
          <div className="mx-auto mt-auto grid w-full max-w-4xl grid-cols-2 gap-4 pb-2">
            {curAnswers.map((a, i) => (
              <div
                key={a.id}
                className={`flex items-center gap-4 rounded-xl px-5 py-4 text-lg font-bold text-white ${ANSWER_BG[i % 4]}`}
              >
                <span className="shrink-0 text-2xl text-white/90">
                  {ANSWER_SHAPES[i % 4]}
                </span>
                <span>{a.text}</span>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  /* ---- RESULTS ---- */
  if (phase === "results" && curQ) {
    return (
      <div className="flex min-h-screen flex-col bg-[#27b8c9]">
        {header}
        <main className="flex flex-1 flex-col items-center gap-5 p-6">
          <span className="rounded-full bg-orange-500 px-6 py-2 text-lg font-bold text-white">
            Question {qIdx + 1} of {questions.length}
          </span>

          <div className="w-full max-w-3xl rounded-2xl bg-white px-8 py-6 text-center shadow-xl">
            <p className="text-xl font-bold text-zinc-800">{curQ.text}</p>
          </div>

          <div className="grid w-full max-w-3xl grid-cols-2 gap-4">
            {curAnswers.map((a, i) => (
              <div
                key={a.id}
                className={`flex items-center gap-3 rounded-xl px-6 py-5 text-lg font-bold text-white ${
                  a.is_correct
                    ? "bg-green-500 ring-4 ring-green-300"
                    : "bg-zinc-400 opacity-60"
                }`}
              >
                <span className="text-2xl">
                  {a.is_correct ? "✓" : ANSWER_SHAPES[i % 4]}
                </span>
                <span>{a.text}</span>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  /* ---- SCOREBOARD ---- */
  if (phase === "scoreboard") {
    const top5 = leaderboard.slice(0, 5);
    return (
      <div className="flex min-h-screen flex-col bg-[#27b8c9]">
        {header}
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
          <button
            onClick={() => void advance()}
            className="mt-4 rounded-xl bg-orange-500 px-8 py-3 text-lg font-bold text-white transition hover:bg-orange-600"
          >
            {qIdx + 1 >= questions.length ? "Final Results" : "Next Question"}
          </button>
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
        {header}
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

          <button
            onClick={() => void handleLeave("/home")}
            className="mt-6 rounded-xl bg-orange-500 px-8 py-3 text-lg font-bold text-white transition hover:bg-orange-600"
          >
            Back to Home
          </button>
        </main>
      </div>
    );
  }

  return null;
}
