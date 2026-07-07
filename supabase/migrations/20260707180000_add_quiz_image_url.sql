-- Add an optional cover image to quizzes.
-- Shown on the dashboard quiz card (left thumbnail).

alter table public.quizzes
  add column if not exists image_url text;
