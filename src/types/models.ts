export type UUID = string;

export type SessionStatus = "active" | "completed";

export interface UserProfile {
  id: UUID;
  username: string;
  created_at: string;
}

export interface Quiz {
  id: UUID;
  user_id: UUID;
  title: string;
  description: string | null;
  created_at: string;
}

export interface Question {
  id: UUID;
  quiz_id: UUID;
  text: string;
  image_url: string | null;
  time_limit: number;
}

export interface Answer {
  id: UUID;
  question_id: UUID;
  text: string;
  is_correct: boolean;
}

export interface Session {
  id: UUID;
  quiz_id: UUID;
  host_id: UUID;
  code: string;
  current_question: UUID | null;
  status: SessionStatus;
  created_at: string;
}

export interface SessionParticipant {
  id: UUID;
  session_id: UUID;
  user_id: UUID | null;
  nickname: string;
  score: number;
}

export interface ResponseRow {
  id: UUID;
  session_id: UUID;
  participant_id: UUID;
  question_id: UUID;
  answer_id: UUID;
  is_correct: boolean;
}
