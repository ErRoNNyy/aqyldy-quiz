"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/src/components/ui/Button";
import { Card } from "@/src/components/ui/Card";
import {
  getAnswersForQuestion,
  getLeaderboard,
  getQuestionById,
  getSession,
  submitResponse,
} from "@/src/services/supabase/api";
import { useSessionRealtime } from "@/src/hooks/useSessionRealtime";
import { useSessionStore } from "@/src/store/sessionStore";
import type { Answer, Question, Session } from "@/src/types/models";

export function PlayPanel() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("session");
  const participantId = params.get("participant");

  const [session, setSession] = useState<Session | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null);
  const [submittedQuestions, setSubmittedQuestions] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState("");

  const leaderboard = useSessionStore((state) => state.leaderboard);
  const setLeaderboard = useSessionStore((state) => state.setLeaderboard);

  const hasSubmitted = useMemo(() => {
    if (!question) {
      return false;
    }
    return submittedQuestions[question.id] ?? false;
  }, [question, submittedQuestions]);

  const loadQuestion = useCallback(async (questionId: string | null) => {
    if (!questionId) {
      setQuestion(null);
      setAnswers([]);
      setSelectedAnswerId(null);
      return;
    }
    const loadedQuestion = await getQuestionById(questionId);
    const loadedAnswers = await getAnswersForQuestion(questionId);
    setQuestion(loadedQuestion);
    setAnswers(loadedAnswers);
    setSelectedAnswerId(null);
  }, []);

  useEffect(() => {
    async function init() {
      if (!sessionId || !participantId) {
        router.replace("/join");
        return;
      }
      try {
        const loadedSession = await getSession(sessionId);
        setSession(loadedSession);
        await loadQuestion(loadedSession.current_question);
        const board = await getLeaderboard(sessionId);
        setLeaderboard(board);
      } catch (error) {
        setStatus((error as Error).message);
      }
    }
    void init();
  }, [loadQuestion, participantId, router, sessionId, setLeaderboard]);

  useSessionRealtime({
    sessionId,
    onSessionUpdate: (updatedSession) => {
      setSession(updatedSession);
      void loadQuestion(updatedSession.current_question);
    },
    onResponseInsert: () => {
      if (!sessionId) {
        return;
      }
      void getLeaderboard(sessionId).then(setLeaderboard);
    },
  });

  async function handleSubmit() {
    if (!sessionId || !participantId || !question || !selectedAnswerId) {
      return;
    }
    try {
      await submitResponse(sessionId, participantId, question.id, selectedAnswerId);
      setSubmittedQuestions((current) => ({ ...current, [question.id]: true }));
      setStatus("Answer submitted.");
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Card>
        <h1 className="text-2xl font-bold">Live Quiz</h1>
        <p className="text-sm text-zinc-600">Session status: {session?.status ?? "loading..."}</p>
      </Card>

      <Card>
        {!question ? (
          <p className="text-sm text-zinc-600">
            Waiting for host to start or move to next question...
          </p>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <h2 className="text-xl font-semibold">{question.text}</h2>
            {question.image_url && (
              <img
                src={question.image_url}
                alt="Question visual"
                className="max-h-64 rounded-lg border border-zinc-200"
              />
            )}
            <div className="grid gap-2">
              {answers.map((answer) => (
                <label
                  key={answer.id}
                  className="flex items-center gap-2 rounded-lg border border-zinc-200 p-2"
                >
                  <input
                    type="radio"
                    name="answer"
                    value={answer.id}
                    checked={selectedAnswerId === answer.id}
                    disabled={hasSubmitted}
                    onChange={() => setSelectedAnswerId(answer.id)}
                  />
                  {answer.text}
                </label>
              ))}
            </div>
            <Button
              disabled={!selectedAnswerId || hasSubmitted || session?.status !== "active"}
              onClick={handleSubmit}
            >
              {hasSubmitted ? "Already submitted" : "Submit answer"}
            </Button>
          </motion.div>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-xl font-semibold">Leaderboard</h2>
        {leaderboard.length === 0 ? (
          <p className="text-sm text-zinc-600">No scores yet.</p>
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
