-- CodeForge — Roles & Profiles
--
-- `profiles` extends Supabase's `auth.users` with product-level identity.
-- Public signup can only ever create STUDENT profiles — MENTOR and ADMIN
-- are granted out-of-band (see 012_rls.sql: no client-side policy allows
-- a user to set their own role above 'student').

create type user_role as enum ('student', 'mentor', 'admin');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text,
  avatar_url text,
  role user_role not null default 'student',
  bio text,
  preferred_language_id uuid, -- fk added in 003 after `languages` exists
  timezone text not null default 'UTC',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint username_format check (username ~ '^[a-z0-9_-]{3,32}$')
);

create index idx_profiles_role on profiles (role);

-- Auto-create a `profiles` row whenever a new Supabase auth user is created.
create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data ->> 'display_name', null)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();
