-- CodeForge — Interview Simulation, Achievements & Notifications
-- Interview simulator logic is a Prompt 8 concern; this is its storage shape.

create type interview_kind as enum ('coding', 'debugging', 'system_design', 'behavioral');
create type interview_status as enum ('in_progress', 'completed', 'abandoned');

create table interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  kind interview_kind not null,
  status interview_status not null default 'in_progress',
  problem_id uuid references problems (id) on delete set null,
  transcript jsonb not null default '[]'::jsonb,
  score numeric(5, 2),
  feedback text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index idx_interview_sessions_user on interview_sessions (user_id);

create table achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  achievement_key text not null, -- e.g. "first_boss_defeated"
  title text not null,
  description text not null,
  earned_at timestamptz not null default now(),

  constraint unique_user_achievement unique (user_id, achievement_key)
);

create index idx_achievements_user on achievements (user_id);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  body text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_notifications_user on notifications (user_id);
create index idx_notifications_user_unread on notifications (user_id) where read_at is null;
