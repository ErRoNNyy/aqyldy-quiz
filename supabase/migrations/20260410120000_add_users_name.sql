-- Add alphanumeric display name to public.users (letters and digits only).

alter table public.users add column if not exists name text;

update public.users
set name = nullif(trim(both from regexp_replace(coalesce(username, ''), '[^a-zA-Z0-9]', '', 'g')), '')
where name is null;

update public.users
set name = 'user' || substring(replace(id::text, '-', '') from 1 for 8)
where name is null or name = '';

alter table public.users alter column name set not null;

alter table public.users drop constraint if exists users_name_alphanumeric;
alter table public.users add constraint users_name_alphanumeric check (name ~ '^[a-zA-Z0-9]+$');
