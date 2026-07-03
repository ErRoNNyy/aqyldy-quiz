-- Track when a quiz (or its questions) was last edited.

alter table public.quizzes
  add column if not exists updated_at timestamptz not null default now();

-- Backfill: start from creation time for existing quizzes.
update public.quizzes
set updated_at = created_at
where updated_at is null or updated_at < created_at;
