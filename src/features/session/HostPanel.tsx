"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/src/components/ui/Button";
import { Card } from "@/src/components/ui/Card";
import {
  completeSession,
  createSession,
  ensureProfile,
  getCurrentUser,
  getLeaderboard,
  getMyQuizzes,
  getQuizQuestions,
  setCurrentQuestion,
} from "@/src/services/supabase/api";
import { useSessionRealtime } from "@/src/hooks/useSessionRealtime";
import { useSessionStore } from "@/src/store/sessionStore";
import { isSupabaseConfigured } from "@/src/services/supabase/client";
import type { Question, Quiz, Session } from "@/src/types/models";

export function HostPanel() {
  const router = useRouter();
  const [hostId, setHostId] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [questionIndex, setQuestionIndex] = useState(-1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const leaderboard = useSessionStore((state) => state.leaderboard);
  const setLeaderboard = useSessionStore((state) => state.setLeaderboard);

  useSessionRealtime({
    sessionId: session?.id ?? null,
    onSessionUpdate: (updatedSession) => {
      setSession(updatedSession);
    },
    onResponseInsert: () => {
      if (!session?.id) {
        return;
      }
      void getLeaderboard(session.id).then(setLeaderboard);
    },
  });

  useEffect(() => {
    async function init() {
      if (!isSupabaseConfigured) {
        setStatus("Configure Supabase ENV first.");
        return;
      }
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.replace("/signin?next=/host");
          return;
        }
        await ensureProfile(user, user.email?.split("@")[0] ?? "host");
        setHostId(user.id);
        const myQuizzes = await getMyQuizzes(user.id);
        setQuizzes(myQuizzes);
        if (myQuizzes[0]) {
          setSelectedQuizId(myQuizzes[0].id);
          const loadedQuestions = await getQuizQuestions(myQuizzes[0].id);
          setQuestions(loadedQuestions);
        }
      } catch (error) {
        setStatus((error as Error).message);
      }
    }
    void init();
  }, [router]);

  useEffect(() => {
    if (!selectedQuizId) {
      setQuestions([]);
      return;
    }
    void getQuizQuestions(selectedQuizId).then(setQuestions);
  }, [selectedQuizId]);

  const currentQuestion = useMemo(() => {
    if (questionIndex < 0) {
      return null;
    }
    return questions[questionIndex] ?? null;
  }, [questionIndex, questions]);

  async function startSession() {
    if (!selectedQuizId || !hostId) {
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      const created = await createSession(selectedQuizId, hostId);
      setSession(created);
      setQuestionIndex(-1);
      setLeaderboard([]);
      setStatus(`Session created. Join code: ${created.code}`);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function nextQuestion() {
    if (!session) {
      return;
    }
    const nextIndex = questionIndex + 1;
    const next = questions[nextIndex];
    if (!next) {
      setStatus("No more questions. End session when ready.");
      return;
    }
    await setCurrentQuestion(session.id, next.id);
    setQuestionIndex(nextIndex);
    setStatus(`Current question updated: ${nextIndex + 1}/${questions.length}`);
  }

  async function endSession() {
    if (!session) {
      return;
    }
    await completeSession(session.id);
    setStatus("Session completed.");
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <Card>
        <h1 className="mb-3 text-2xl font-bold">Host Session</h1>
        <div className="flex flex-wrap gap-3">
          <select
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            value={selectedQuizId}
            onChange={(event) => setSelectedQuizId(event.target.value)}
          >
            <option value="">Select quiz to host</option>
            {quizzes.map((quiz) => (
              <option key={quiz.id} value={quiz.id}>
                {quiz.title}
              </option>
            ))}
          </select>
          <Button disabled={loading || !selectedQuizId} onClick={startSession}>
            Start session
          </Button>
          <Button
            variant="secondary"
            disabled={!session || questions.length === 0}
            onClick={nextQuestion}
          >
            Next question
          </Button>
          <Button variant="danger" disabled={!session} onClick={endSession}>
            End session
          </Button>
        </div>
      </Card>

      {session && (
        <Card>
          <h2 className="text-xl font-semibold">Live Session</h2>
          <p className="text-sm text-zinc-600">Join code: {session.code}</p>
          <p className="text-sm text-zinc-600">Status: {session.status}</p>
          <p className="mt-2 text-sm">
            Current question: {currentQuestion?.text ?? "Not started yet"}
          </p>
        </Card>
      )}

      <Card>
        <h2 className="mb-2 text-xl font-semibold">Live Leaderboard</h2>
        {leaderboard.length === 0 ? (
          <p className="text-sm text-zinc-600">No answers submitted yet.</p>
        ) : (
          <ol className="space-y-2">
            {leaderboard.map((entry, index) => (
              <li key={entry.id} className="flex justify-between rounded-lg border p-2">
                <span>
                  #{index + 1} {entry.nickname}
                </span>
                <span>{entry.score} pts</span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {status && <p className="text-sm text-violet-700">{status}</p>}
    </div>
  );
}
