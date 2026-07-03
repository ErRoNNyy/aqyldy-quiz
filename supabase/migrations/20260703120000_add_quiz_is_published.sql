-- Add explicit publish state to quizzes.
-- Quiz lifecycle: draft (default) -> published -> hosted (active session).

alter table public.quizzes
  add column if not exists is_published boolean not null default false;

-- Backfill: any quiz that already has at least one session was effectively
-- published before this column existed, so mark it published.
update public.quizzes q
set is_published = true
where exists (
  select 1 from public.sessions s where s.quiz_id = q.id
);
