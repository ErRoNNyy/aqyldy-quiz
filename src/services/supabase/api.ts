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

const ALPHANUMERIC_NAME = /^[a-zA-Z0-9]+$/;

export function isProfileComplete(profile: UserProfile | null | undefined): boolean {
  if (!profile) {
    return false;
  }
  return (
    !!profile.name &&
    ALPHANUMERIC_NAME.test(profile.name) &&
    !!profile.school_organization?.trim() &&
    !!profile.preferred_language?.trim()
  );
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

export async function updateProfile(
  userId: string,
  payload: {
    name: string;
    schoolOrganization: string;
    preferredLanguage: string;
  },
) {
  const name = payload.name.trim();
  const school = payload.schoolOrganization.trim();
  const lang = payload.preferredLanguage.trim();
  if (!name || !ALPHANUMERIC_NAME.test(name)) {
    throw new Error("Name must contain letters and numbers only.");
  }

  const { error } = await supabase
    .from("users")
    .update({
      name,
      school_organization: school || null,
      preferred_language: lang || null,
    })
    .eq("id", userId);
  if (error) throw error;
}

export async function deleteUserAccount(userId: string) {
  await supabase.from("responses").delete().eq("participant_id", userId);
  await supabase.from("session_participants").delete().eq("user_id", userId);
  await supabase.from("sessions").delete().eq("host_id", userId);
  await supabase.from("quizzes").delete().eq("user_id", userId);
  await supabase.from("users").delete().eq("id", userId);
  await supabase.auth.signOut();
}

export async function ensureProfile(user: User, username: string) {
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) {
    return;
  }

  const { error } = await supabase.from("users").insert({
    id: user.id,
    username,
    name: null,
    school_organization: null,
    preferred_language: null,
  });

  if (error && error.code !== "23505") {
    throw error;
  }
}

export async function completeProfile(
  userId: string,
  payload: {
    name: string;
    schoolOrganization: string;
    preferredLanguage: string;
  },
) {
  const name = payload.name.trim();
  const school = payload.schoolOrganization.trim();
  const lang = payload.preferredLanguage.trim();
  if (!name || !ALPHANUMERIC_NAME.test(name)) {
    throw new Error("Name must contain letters and numbers only.");
  }
  if (!school) {
    throw new Error("School or organization is required.");
  }
  if (!lang) {
    throw new Error("Preferred language is required.");
  }

  const { error } = await supabase
    .from("users")
    .update({
      name,
      school_organization: school,
      preferred_language: lang,
    })
    .eq("id", userId);

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

export async function getProfileMaybe(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle<UserProfile>();
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

export async function updateQuiz(
  quizId: string,
  updates: { title?: string; description?: string | null },
) {
  const patch: Record<string, string | null> = {};
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.description !== undefined) patch.description = updates.description;

  const { data, error } = await supabase
    .from("quizzes")
    .update(patch)
    .eq("id", quizId)
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

export async function getQuestionCountsForQuizzes(quizIds: string[]) {
  if (quizIds.length === 0) {
    return {} as Record<string, number>;
  }

  const { data, error } = await supabase
    .from("questions")
    .select("quiz_id")
    .in("quiz_id", quizIds);

  if (error) {
    throw error;
  }

  return (data ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.quiz_id] = (acc[row.quiz_id] ?? 0) + 1;
    return acc;
  }, {});
}

export async function getQuizQuestions(quizId: string) {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("quiz_id", quizId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<Question[]>();
  if (error) {
    throw error;
  }
  return data;
}

export async function reorderQuestions(orderedIds: string[]) {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("questions")
      .update({ position: i })
      .eq("id", orderedIds[i]);
    if (error) throw error;
  }
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

export async function updateQuestion(
  questionId: string,
  quizId: string,
  payload: CreateQuestionPayload,
) {
  let imageUrl: string | null = null;
  if (payload.imageFile) {
    imageUrl = await uploadQuestionImage(quizId, payload.imageFile);
  }

  const updateData: Record<string, unknown> = {
    text: payload.text,
    time_limit: payload.timeLimit,
  };
  if (imageUrl) updateData.image_url = imageUrl;

  const { error: qErr } = await supabase
    .from("questions")
    .update(updateData)
    .eq("id", questionId);
  if (qErr) throw qErr;

  const { error: delErr } = await supabase
    .from("answers")
    .delete()
    .eq("question_id", questionId);
  if (delErr) throw delErr;

  const answerRows = payload.answers.map((a) => ({
    question_id: questionId,
    text: a.text,
    is_correct: a.isCorrect,
  }));
  const { error: aErr } = await supabase.from("answers").insert(answerRows);
  if (aErr) throw aErr;
}

export async function deleteQuestion(questionId: string) {
  const { error: aErr } = await supabase
    .from("answers")
    .delete()
    .eq("question_id", questionId);
  if (aErr) throw aErr;

  const { error: qErr } = await supabase
    .from("questions")
    .delete()
    .eq("id", questionId);
  if (qErr) throw qErr;
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

export async function addParticipant(
  sessionId: string,
  nickname: string,
  userId?: string,
  avatarUrl?: string,
) {
  const { data, error } = await supabase
    .from("session_participants")
    .insert({
      session_id: sessionId,
      user_id: userId ?? null,
      nickname,
      score: 0,
      avatar_url: avatarUrl ?? null,
    })
    .select("*")
    .single<SessionParticipant>();
  if (error) {
    throw error;
  }
  return data;
}

export async function getSessionParticipants(sessionId: string) {
  const { data, error } = await supabase
    .from("session_participants")
    .select("*")
    .eq("session_id", sessionId)
    .returns<SessionParticipant[]>();
  if (error) throw error;
  return data;
}

export function subscribeParticipants(
  sessionId: string,
  onInsert: (p: SessionParticipant) => void,
): RealtimeChannel {
  return supabase
    .channel(`public:session_participants:session_id=eq.${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "session_participants",
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        onInsert(payload.new as SessionParticipant);
      },
    )
    .subscribe();
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

export async function deleteSession(sessionId: string) {
  await supabase
    .from("session_participants")
    .delete()
    .eq("session_id", sessionId);

  await supabase
    .from("responses")
    .delete()
    .eq("session_id", sessionId);

  const { error } = await supabase
    .from("sessions")
    .delete()
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

/**
 * @param timeRatio 0 = answered instantly, 1 = answered at the last second
 * Correct:   1000 (instant) → 500 (last second)
 * Incorrect: -100 (instant) → -500 (last second)
 * Returns the points delta applied.
 */
export async function submitResponse(
  sessionId: string,
  participantId: string,
  questionId: string,
  answerId: string,
  timeRatio: number,
): Promise<number> {
  const clamped = Math.max(0, Math.min(1, timeRatio));
  const answers = await getAnswersForQuestion(questionId);
  const selected = answers.find((answer) => answer.id === answerId);
  const isCorrect = Boolean(selected?.is_correct);

  const delta = isCorrect
    ? Math.round(1000 - 500 * clamped)
    : -Math.round(100 + 400 * clamped);

  const { data: participant, error: participantError } = await supabase
    .from("session_participants")
    .select("*")
    .eq("id", participantId)
    .single<SessionParticipant>();
  if (participantError) throw participantError;

  const newScore = Math.max(0, participant.score + delta);
  const { error: updateScoreError } = await supabase
    .from("session_participants")
    .update({ score: newScore })
    .eq("id", participantId);
  if (updateScoreError) throw updateScoreError;

  const { error } = await supabase.from("responses").insert({
    session_id: sessionId,
    participant_id: participantId,
    question_id: questionId,
    answer_id: answerId,
    is_correct: isCorrect,
  });
  if (error) throw error;

  return delta;
}

export async function getResponseCountForQuestion(
  sessionId: string,
  questionId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("responses")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("question_id", questionId);
  if (error) throw error;
  return count ?? 0;
}

export async function getCorrectCounts(
  sessionId: string,
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("responses")
    .select("participant_id")
    .eq("session_id", sessionId)
    .eq("is_correct", true);
  if (error) throw error;
  const map: Record<string, number> = {};
  for (const r of data ?? []) {
    map[r.participant_id] = (map[r.participant_id] ?? 0) + 1;
  }
  return map;
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
