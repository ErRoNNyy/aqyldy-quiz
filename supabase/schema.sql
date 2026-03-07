-- Kahoot KZ schema for Supabase (PostgreSQL)

create extension if not exists "uuid-ossp";

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  text text not null,
  image_url text,
  time_limit integer not null default 20
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  text text not null,
  is_correct boolean not null default false
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  host_id uuid not null references public.users(id) on delete cascade,
  code text not null unique,
  current_question uuid references public.questions(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  nickname text not null,
  score integer not null default 0
);

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  participant_id uuid not null references public.session_participants(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  answer_id uuid not null references public.answers(id) on delete cascade,
  is_correct boolean not null
);

alter table public.users enable row level security;
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;
alter table public.sessions enable row level security;
alter table public.session_participants enable row level security;
alter table public.responses enable row level security;

-- Users can read/write their profile
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users
for select using (auth.uid() = id);

drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own" on public.users
for insert with check (auth.uid() = id);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
for update using (auth.uid() = id);

-- Quizzes owned by creator
drop policy if exists "quizzes_select_all" on public.quizzes;
create policy "quizzes_select_all" on public.quizzes
for select using (true);

drop policy if exists "quizzes_modify_owner" on public.quizzes;
create policy "quizzes_modify_owner" on public.quizzes
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Questions follow quiz ownership
drop policy if exists "questions_select_all" on public.questions;
create policy "questions_select_all" on public.questions
for select using (true);

drop policy if exists "questions_modify_owner" on public.questions;
create policy "questions_modify_owner" on public.questions
for all using (
  exists (
    select 1 from public.quizzes q
    where q.id = quiz_id and q.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.quizzes q
    where q.id = quiz_id and q.user_id = auth.uid()
  )
);

drop policy if exists "answers_select_all" on public.answers;
create policy "answers_select_all" on public.answers
for select using (true);

drop policy if exists "answers_modify_owner" on public.answers;
create policy "answers_modify_owner" on public.answers
for all using (
  exists (
    select 1
    from public.questions qu
    join public.quizzes q on q.id = qu.quiz_id
    where qu.id = question_id and q.user_id = auth.uid()
  )
) with check (
  exists (
    select 1
    from public.questions qu
    join public.quizzes q on q.id = qu.quiz_id
    where qu.id = question_id and q.user_id = auth.uid()
  )
);

drop policy if exists "sessions_select_all" on public.sessions;
create policy "sessions_select_all" on public.sessions
for select using (true);

drop policy if exists "sessions_host_modify" on public.sessions;
create policy "sessions_host_modify" on public.sessions
for all using (auth.uid() = host_id) with check (auth.uid() = host_id);

drop policy if exists "participants_select_all" on public.session_participants;
create policy "participants_select_all" on public.session_participants
for select using (true);

drop policy if exists "participants_insert_all" on public.session_participants;
create policy "participants_insert_all" on public.session_participants
for insert with check (true);

drop policy if exists "participants_update_host_only" on public.session_participants;
create policy "participants_update_host_only" on public.session_participants
for update using (
  exists (
    select 1 from public.sessions s
    where s.id = session_id and s.host_id = auth.uid()
  )
);

drop policy if exists "responses_select_all" on public.responses;
create policy "responses_select_all" on public.responses
for select using (true);

drop policy if exists "responses_insert_all" on public.responses;
create policy "responses_insert_all" on public.responses
for insert with check (true);

alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.responses;
alter publication supabase_realtime add table public.session_participants;
