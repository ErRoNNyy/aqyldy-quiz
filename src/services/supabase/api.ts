"use client";

import type { RealtimeChannel, User } from "@supabase/supabase-js";
import imageCompression from "browser-image-compression";
import { supabase } from "@/src/services/supabase/client";
import type {
  Answer,
  Question,
  Quiz,
  ResponseRow,
  Session,
  SessionParticipant,
  UserProfile,
} from "@/src/types/models";

export interface CreateQuestionPayload {
  text: string;
  timeLimit: number;
  imageFile?: File | null;
  answers: Array<{ text: string; isCorrect: boolean }>;
}

export async function getCurrentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function signUp(email: string, password: string) {
  return supabase.auth.signUp({ email, password });
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function ensureProfile(user: User, username: string) {
  const { error } = await supabase.from("users").upsert({
    id: user.id,
    username,
  });
  if (error) {
    throw error;
  }
}

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single<UserProfile>();
  if (error) {
    throw error;
  }
  return data;
}

export async function getMyQuizzes(userId: string) {
  const { data, error } = await supabase
    .from("quizzes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .returns<Quiz[]>();
  if (error) {
    throw error;
  }
  return data;
}

export async function createQuiz(userId: string, title: string, description: string) {
  const { data, error } = await supabase
    .from("quizzes")
    .insert({
      user_id: userId,
      title,
      description: description || null,
    })
    .select("*")
    .single<Quiz>();

  if (error) {
    throw error;
  }
  return data;
}

export async function deleteQuiz(quizId: string) {
  const { error } = await supabase.from("quizzes").delete().eq("id", quizId);
  if (error) {
    throw error;
  }
}

export async function getQuizQuestions(quizId: string) {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("quiz_id", quizId)
    .order("id", { ascending: true })
    .returns<Question[]>();
  if (error) {
    throw error;
  }
  return data;
}

export async function getAnswersByQuestionIds(questionIds: string[]) {
  if (questionIds.length === 0) {
    return [] as Answer[];
  }

  const { data, error } = await supabase
    .from("answers")
    .select("*")
    .in("question_id", questionIds)
    .returns<Answer[]>();
  if (error) {
    throw error;
  }
  return data;
}

async function uploadQuestionImage(quizId: string, file: File) {
  const compressed = await imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1280,
    useWebWorker: true,
  });
  const extension = compressed.name.split(".").pop() ?? "jpg";
  const path = `quiz_${quizId}/${Date.now()}.${extension}`;

  const { data, error } = await supabase.storage
    .from("quiz-images")
    .upload(path, compressed, { cacheControl: "3600", upsert: true });
  if (error) {
    throw error;
  }

  const { data: publicData } = supabase.storage
    .from("quiz-images")
    .getPublicUrl(data.path);
  return publicData.publicUrl;
}

export async function createQuestion(quizId: string, payload: CreateQuestionPayload) {
  let imageUrl: string | null = null;
  if (payload.imageFile) {
    imageUrl = await uploadQuestionImage(quizId, payload.imageFile);
  }

  const { data: question, error: questionError } = await supabase
    .from("questions")
    .insert({
      quiz_id: quizId,
      text: payload.text,
      image_url: imageUrl,
      time_limit: payload.timeLimit,
    })
    .select("*")
    .single<Question>();

  if (questionError) {
    throw questionError;
  }

  const answerRows = payload.answers.map((answer) => ({
    question_id: question.id,
    text: answer.text,
    is_correct: answer.isCorrect,
  }));

  const { error: answersError } = await supabase.from("answers").insert(answerRows);
  if (answersError) {
    throw answersError;
  }

  return question;
}

export async function createSession(quizId: string, hostId: string) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      quiz_id: quizId,
      host_id: hostId,
      code,
      status: "active",
      current_question: null,
    })
    .select("*")
    .single<Session>();
  if (error) {
    throw error;
  }
  return data;
}

export async function findSessionByCode(code: string) {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("code", code)
    .eq("status", "active")
    .single<Session>();
  if (error) {
    throw error;
  }
  return data;
}

export async function addParticipant(sessionId: string, nickname: string, userId?: string) {
  const { data, error } = await supabase
    .from("session_participants")
    .insert({
      session_id: sessionId,
      user_id: userId ?? null,
      nickname,
      score: 0,
    })
    .select("*")
    .single<SessionParticipant>();
  if (error) {
    throw error;
  }
  return data;
}

export async function getSession(sessionId: string) {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single<Session>();
  if (error) {
    throw error;
  }
  return data;
}

export async function setCurrentQuestion(sessionId: string, questionId: string | null) {
  const { error } = await supabase
    .from("sessions")
    .update({ current_question: questionId })
    .eq("id", sessionId);
  if (error) {
    throw error;
  }
}

export async function completeSession(sessionId: string) {
  const { error } = await supabase
    .from("sessions")
    .update({ status: "completed", current_question: null })
    .eq("id", sessionId);
  if (error) {
    throw error;
  }
}

export async function getQuestionById(questionId: string) {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("id", questionId)
    .single<Question>();
  if (error) {
    throw error;
  }
  return data;
}

export async function getAnswersForQuestion(questionId: string) {
  const { data, error } = await supabase
    .from("answers")
    .select("*")
    .eq("question_id", questionId)
    .returns<Answer[]>();
  if (error) {
    throw error;
  }
  return data;
}

export async function submitResponse(
  sessionId: string,
  participantId: string,
  questionId: string,
  answerId: string,
) {
  const answers = await getAnswersForQuestion(questionId);
  const selected = answers.find((answer) => answer.id === answerId);
  const isCorrect = Boolean(selected?.is_correct);

  const { error } = await supabase.from("responses").insert({
    session_id: sessionId,
    participant_id: participantId,
    question_id: questionId,
    answer_id: answerId,
    is_correct: isCorrect,
  });
  if (error) {
    throw error;
  }

  if (isCorrect) {
    const { data: participant, error: participantError } = await supabase
      .from("session_participants")
      .select("*")
      .eq("id", participantId)
      .single<SessionParticipant>();
    if (participantError) {
      throw participantError;
    }

    const { error: updateScoreError } = await supabase
      .from("session_participants")
      .update({ score: participant.score + 100 })
      .eq("id", participantId);
    if (updateScoreError) {
      throw updateScoreError;
    }
  }
}

export async function getLeaderboard(sessionId: string) {
  const { data, error } = await supabase
    .from("session_participants")
    .select("*")
    .eq("session_id", sessionId)
    .order("score", { ascending: false })
    .returns<SessionParticipant[]>();
  if (error) {
    throw error;
  }
  return data;
}

export function subscribeSession(
  sessionId: string,
  onUpdate: (payload: Session) => void,
): RealtimeChannel {
  return supabase
    .channel(`public:sessions:id=eq.${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "sessions",
        filter: `id=eq.${sessionId}`,
      },
      (payload) => {
        onUpdate(payload.new as Session);
      },
    )
    .subscribe();
}

export function subscribeResponses(
  sessionId: string,
  onInsert: (payload: ResponseRow) => void,
): RealtimeChannel {
  return supabase
    .channel(`public:responses:session_id=eq.${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "responses",
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        onInsert(payload.new as ResponseRow);
      },
    )
    .subscribe();
}

export function removeSubscription(channel: RealtimeChannel) {
  supabase.removeChannel(channel);
}
