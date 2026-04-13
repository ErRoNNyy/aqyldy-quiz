-- Defer name to profile setup; add school/org and language; keep legacy rows complete.

alter table public.users add column if not exists school_organization text;
alter table public.users add column if not exists preferred_language text;

alter table public.users drop constraint if exists users_name_alphanumeric;
alter table public.users drop constraint if exists users_name_check;
alter table public.users alter column name drop not null;
alter table public.users add constraint users_name_alphanumeric
  check (name is null or name ~ '^[a-zA-Z0-9]+$');

update public.users
set school_organization = 'N/A', preferred_language = 'en'
where name is not null
  and (school_organization is null or trim(school_organization) = '')
  and (preferred_language is null or trim(preferred_language) = '');
