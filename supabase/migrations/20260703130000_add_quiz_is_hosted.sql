-- Add explicit hosted state to quizzes.
-- Set true the first time a quiz is hosted; it stays true permanently afterwards.

alter table public.quizzes
  add column if not exists is_hosted boolean not null default false;

-- Backfill: any quiz that has ever had a session was hosted at least once.
update public.quizzes q
set is_hosted = true
where exists (
  select 1 from public.sessions s
  where s.quiz_id = q.id
);
