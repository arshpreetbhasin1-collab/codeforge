-- CodeForge — Learning Events, Progress, Mastery & Mistake DNA
--
-- `learning_events` is the append-only source of truth: every meaningful
-- student action becomes one row here (see LEARNING EVENT MODEL). Every
-- other progress table in this file is a derived, queryable projection of
-- this log — never a substitute for it. Do not compute "progress" from
-- anything that isn't ultimately traceable to a learning_events row.

create type learning_event_type as enum (
  'lesson_viewed',
  'lesson_completed',
  'challenge_started',
  'submission_created',
  'submission_passed',
  'submission_failed',
  'hint_requested',
  'solution_viewed',
  'concept_reviewed',
  'problem_abandoned',
  'boss_started',
  'boss_completed',
  'project_started',
  'project_completed',
  'interview_started',
  'interview_completed'
);

create table learning_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  event_type learning_event_type not null,
  skill_id uuid references skills (id) on delete set null,
  problem_id uuid references problems (id) on delete set null,
  lesson_id uuid references lessons (id) on delete set null,
  submission_id uuid references submissions (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_learning_events_user on learning_events (user_id);
create index idx_learning_events_type on learning_events (event_type);
create index idx_learning_events_user_created on learning_events (user_id, created_at desc);

-- Coarse per-skill progress, cheap to read for dashboards.
-- `skill_mastery` (below) holds the actual computed mastery score;
-- this table is the lightweight "have they touched this skill at all" index.
create table user_skill_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  skill_id uuid not null references skills (id) on delete cascade,
  attempt_count integer not null default 0,
  success_count integer not null default 0,
  last_attempted_at timestamptz,
  created_at timestamptz not null default now(),

  constraint unique_user_skill_progress unique (user_id, skill_id)
);

create index idx_user_skill_progress_user on user_skill_progress (user_id);

-- The output of calculateSkillMastery() (see services/mastery). Deliberately
-- holds more than a single score: confidence and last_reviewed exist so
-- Prompt 4's spaced-repetition scheduler can decide *when* to re-test a
-- skill, not just *whether* it's mastered.
create table skill_mastery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  skill_id uuid not null references skills (id) on delete cascade,
  mastery_score numeric(5, 2) not null default 0 check (mastery_score between 0 and 100),
  confidence numeric(5, 2) not null default 0 check (confidence between 0 and 100),
  success_rate numeric(5, 2) not null default 0 check (success_rate between 0 and 100),
  attempt_count integer not null default 0,
  last_reviewed_at timestamptz,
  next_review_due_at timestamptz,
  updated_at timestamptz not null default now(),

  constraint unique_skill_mastery unique (user_id, skill_id)
);

create index idx_skill_mastery_user on skill_mastery (user_id);
create index idx_skill_mastery_next_review on skill_mastery (next_review_due_at);

create trigger skill_mastery_set_updated_at
  before update on skill_mastery
  for each row execute function set_updated_at();

-- Mistake DNA: recurring, named failure patterns detected across a user's
-- submissions (e.g. "off-by-one on upper bound", "forgets base case").
-- Prompt 4 owns detection; this table is the durable record it writes to.
create table mistake_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  skill_id uuid references skills (id) on delete set null,
  pattern_key text not null, -- stable machine key, e.g. "off_by_one_upper_bound"
  description text not null,
  occurrence_count integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  constraint unique_user_pattern unique (user_id, pattern_key)
);

create index idx_mistake_patterns_user on mistake_patterns (user_id);

-- Spaced-repetition review queue. One row per scheduled review of a skill.
create type review_outcome as enum ('pending', 'passed', 'failed', 'skipped');

create table review_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  skill_id uuid not null references skills (id) on delete cascade,
  problem_id uuid references problems (id) on delete set null,
  scheduled_for timestamptz not null,
  outcome review_outcome not null default 'pending',
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_review_sessions_user on review_sessions (user_id);
create index idx_review_sessions_scheduled on review_sessions (scheduled_for);
