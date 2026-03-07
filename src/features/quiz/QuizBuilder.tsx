"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/src/components/ui/Button";
import { Card } from "@/src/components/ui/Card";
import { Input, TextArea } from "@/src/components/ui/Field";
import {
  createQuestion,
  createQuiz,
  deleteQuiz,
  getAnswersByQuestionIds,
  getCurrentUser,
  getMyQuizzes,
  getQuizQuestions,
} from "@/src/services/supabase/api";
import { isSupabaseConfigured } from "@/src/services/supabase/client";
import type { Answer, Question, Quiz } from "@/src/types/models";

interface QuestionDraftAnswer {
  text: string;
  isCorrect: boolean;
}

export function QuizBuilder() {
  const [userId, setUserId] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer[]>>({});
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");

  const [questionText, setQuestionText] = useState("");
  const [timeLimit, setTimeLimit] = useState(20);
  const [questionImage, setQuestionImage] = useState<File | null>(null);
  const [questionAnswers, setQuestionAnswers] = useState<QuestionDraftAnswer[]>([
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ]);

  const selectedQuiz = useMemo(
    () => quizzes.find((quiz) => quiz.id === selectedQuizId) ?? null,
    [quizzes, selectedQuizId],
  );

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles[0]) {
      setQuestionImage(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    maxFiles: 1,
  });

  const loadQuizzes = useCallback(async (currentUserId: string) => {
    const rows = await getMyQuizzes(currentUserId);
    setQuizzes(rows);
    if (!selectedQuizId && rows[0]) {
      setSelectedQuizId(rows[0].id);
    }
  }, [selectedQuizId]);

  const loadQuestions = useCallback(async (quizId: string) => {
    const q = await getQuizQuestions(quizId);
    setQuestions(q);
    const ids = q.map((row) => row.id);
    const a = await getAnswersByQuestionIds(ids);
    const grouped = a.reduce<Record<string, Answer[]>>((acc, row) => {
      if (!acc[row.question_id]) {
        acc[row.question_id] = [];
      }
      acc[row.question_id].push(row);
      return acc;
    }, {});
    setAnswers(grouped);
  }, []);

  useEffect(() => {
    async function init() {
      if (!isSupabaseConfigured) {
        setStatus("Configure Supabase ENV first.");
        return;
      }
      try {
        const user = await getCurrentUser();
        if (!user) {
          setStatus("Please sign in first.");
          return;
        }
        setUserId(user.id);
        await loadQuizzes(user.id);
      } catch (error) {
        setStatus((error as Error).message);
      }
    }
    void init();
  }, [loadQuizzes]);

  useEffect(() => {
    if (!selectedQuizId) {
      return;
    }
    void loadQuestions(selectedQuizId);
  }, [loadQuestions, selectedQuizId]);

  async function handleCreateQuiz() {
    if (!userId) {
      return;
    }
    if (!quizTitle.trim()) {
      setStatus("Quiz title is required.");
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      await createQuiz(userId, quizTitle.trim(), quizDescription.trim());
      await loadQuizzes(userId);
      setQuizTitle("");
      setQuizDescription("");
      setStatus("Quiz created.");
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteQuiz() {
    if (!selectedQuizId || !userId) {
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      await deleteQuiz(selectedQuizId);
      setSelectedQuizId("");
      setQuestions([]);
      await loadQuizzes(userId);
      setStatus("Quiz deleted.");
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddQuestion() {
    if (!selectedQuizId) {
      setStatus("Select a quiz first.");
      return;
    }
    if (!questionText.trim()) {
      setStatus("Question text is required.");
      return;
    }
    const validAnswers = questionAnswers.filter((answer) => answer.text.trim());
    if (validAnswers.length < 2) {
      setStatus("Add at least 2 answer options.");
      return;
    }
    if (!validAnswers.some((answer) => answer.isCorrect)) {
      setStatus("Mark at least one correct answer.");
      return;
    }

    setLoading(true);
    setStatus("");
    try {
      await createQuestion(selectedQuizId, {
        text: questionText.trim(),
        timeLimit,
        imageFile: questionImage,
        answers: validAnswers.map((answer) => ({
          text: answer.text.trim(),
          isCorrect: answer.isCorrect,
        })),
      });
      setQuestionText("");
      setQuestionImage(null);
      setTimeLimit(20);
      setQuestionAnswers([
        { text: "", isCorrect: true },
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
      ]);
      await loadQuestions(selectedQuizId);
      setStatus("Question added.");
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <Card>
        <h1 className="mb-3 text-2xl font-bold">Quiz Creation</h1>
        <p className="mb-4 text-sm text-zinc-600">
          Create quizzes, add text/image questions, and configure answer options.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            value={quizTitle}
            placeholder="Quiz title"
            onChange={(event) => setQuizTitle(event.target.value)}
          />
          <TextArea
            value={quizDescription}
            placeholder="Quiz description"
            onChange={(event) => setQuizDescription(event.target.value)}
          />
        </div>
        <div className="mt-3 flex gap-3">
          <Button disabled={loading} onClick={handleCreateQuiz}>
            Create quiz
          </Button>
          <select
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            value={selectedQuizId}
            onChange={(event) => setSelectedQuizId(event.target.value)}
          >
            <option value="">Select quiz</option>
            {quizzes.map((quiz) => (
              <option key={quiz.id} value={quiz.id}>
                {quiz.title}
              </option>
            ))}
          </select>
          <Button
            variant="danger"
            disabled={loading || !selectedQuizId}
            onClick={handleDeleteQuiz}
          >
            Delete selected quiz
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-xl font-semibold">
          Add Question {selectedQuiz ? `to "${selectedQuiz.title}"` : ""}
        </h2>
        <div className="space-y-3">
          <Input
            value={questionText}
            placeholder="Question text"
            onChange={(event) => setQuestionText(event.target.value)}
          />
          <div className="max-w-[180px]">
            <label className="mb-1 block text-sm text-zinc-700">Time limit (seconds)</label>
            <Input
              min={5}
              max={120}
              type="number"
              value={timeLimit}
              onChange={(event) => setTimeLimit(Number(event.target.value))}
            />
          </div>

          <div
            {...getRootProps()}
            className="cursor-pointer rounded-lg border-2 border-dashed border-zinc-300 p-5 text-center"
          >
            <input {...getInputProps()} />
            {isDragActive
              ? "Drop image here..."
              : "Drag & drop image (optional), or click to choose"}
          </div>
          {questionImage && (
            <div className="space-y-2">
              <p className="text-sm text-zinc-600">Selected image: {questionImage.name}</p>
              <img
                src={URL.createObjectURL(questionImage)}
                alt="Question preview"
                className="max-h-44 rounded-lg border border-zinc-200"
              />
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {questionAnswers.map((answer, index) => (
              <div key={`${index}-${answer.text}`} className="rounded-lg border border-zinc-200 p-3">
                <Input
                  value={answer.text}
                  placeholder={`Answer ${index + 1}`}
                  onChange={(event) => {
                    setQuestionAnswers((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, text: event.target.value }
                          : item,
                      ),
                    );
                  }}
                />
                <label className="mt-2 flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={answer.isCorrect}
                    onChange={(event) => {
                      setQuestionAnswers((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, isCorrect: event.target.checked }
                            : item,
                        ),
                      );
                    }}
                  />
                  Correct answer
                </label>
              </div>
            ))}
          </div>

          <Button disabled={loading || !selectedQuizId} onClick={handleAddQuestion}>
            Save question
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-xl font-semibold">Question List</h2>
        <div className="space-y-3">
          {questions.length === 0 && <p className="text-sm text-zinc-600">No questions yet.</p>}
          {questions.map((question) => (
            <div key={question.id} className="rounded-lg border border-zinc-200 p-3">
              <p className="font-semibold">{question.text}</p>
              <p className="text-sm text-zinc-600">Time limit: {question.time_limit}s</p>
              {question.image_url && (
                <img
                  src={question.image_url}
                  alt="Question"
                  className="mt-2 max-h-36 rounded-lg border border-zinc-200"
                />
              )}
              <ul className="mt-2 list-disc pl-5 text-sm">
                {(answers[question.id] ?? []).map((answer) => (
                  <li key={answer.id}>
                    {answer.text} {answer.is_correct ? "(correct)" : ""}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {status && <p className="text-sm text-violet-700">{status}</p>}
    </div>
  );
}
