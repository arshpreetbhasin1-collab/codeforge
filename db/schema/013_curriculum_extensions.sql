-- CodeForge — Prompt 2: Curriculum Extensions
--
-- Additive only — nothing from db/schema/001-012 is renamed or dropped.
-- Adds what the curriculum engine needs that Prompt 1 intentionally left
-- out: language-specific lesson examples (concept vs. syntax — see
-- CURRICULUM PHILOSOPHY), micro-checks, per-language starter code, a
-- normalized mistake taxonomy, and lesson/problem progress tracking
-- (distinct from the Prompt 4 mastery engine — this is simple completion
-- state, not a weighted score).

-- ---------------------------------------------------------------------
-- Modules & lessons: structured fields the content model needs
-- ---------------------------------------------------------------------
alter table modules
  add column learning_objectives text[] not null default '{}',
  add column estimated_minutes integer not null default 30,
  add column difficulty smallint not null default 1 check (difficulty between 1 and 5);

alter table lessons
  add column learning_objectives text[] not null default '{}',
  add column key_takeaways text[] not null default '{}',
  add column estimated_minutes integer not null default 5,
  -- The lesson's one linked "apply it now" problem — see LESSON DESIGN
  -- §9 CODE CHALLENGE. Nullable: not every lesson has a matching problem yet.
  add column next_problem_id uuid references problems (id) on delete set null;

-- Language-specific example code for a lesson. A lesson teaches ONE
-- concept (e.g. "Loops") but can show it in several languages — this is
-- what keeps the curriculum from being duplicated per language (see
-- LANGUAGE STRATEGY). `lessons.example_code`/`example_language_id` from
-- Prompt 1 remains the single default example; this table adds alternates.
create table lesson_code_examples (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons (id) on delete cascade,
  language_id uuid not null references languages (id) on delete cascade,
  code text not null,
  explanation text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),

  constraint unique_lesson_language_example unique (lesson_id, language_id)
);

create index idx_lesson_code_examples_lesson on lesson_code_examples (lesson_id);

-- ---------------------------------------------------------------------
-- Micro-checks — lightweight understanding checks before a problem
-- (see MICRO CHECKS). Distinct from lessons.micro_challenge_prompt
-- (Prompt 1's free-text inline challenge) and distinct from a Problem.
-- ---------------------------------------------------------------------
create type micro_check_type as enum ('multiple_choice', 'predict_output', 'conceptual');

create table micro_checks (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons (id) on delete cascade,
  type micro_check_type not null,
  question text not null,
  code_snippet text, -- used by predict_output checks
  options jsonb, -- used by multiple_choice: [{ id, label }]
  correct_answer text not null, -- option id for MC, exact text for predict_output, null-able free-form for conceptual
  explanation text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_micro_checks_lesson on micro_checks (lesson_id);

create table user_micro_check_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  micro_check_id uuid not null references micro_checks (id) on delete cascade,
  selected_answer text not null,
  is_correct boolean not null,
  attempted_at timestamptz not null default now()
);

create index idx_user_micro_check_attempts_user on user_micro_check_attempts (user_id);
create index idx_user_micro_check_attempts_check on user_micro_check_attempts (micro_check_id);

-- ---------------------------------------------------------------------
-- Problems: type taxonomy + progression level + fields the UI needs
-- (see PROBLEM TYPES, PROBLEM PROGRESSION, PROBLEM METADATA)
-- ---------------------------------------------------------------------
create type problem_kind as enum (
  'implementation',
  'debugging',
  'output_prediction',
  'algorithm_selection',
  'complexity_analysis',
  'code_completion',
  'refactoring',
  'edge_case_reasoning'
);

alter table problems
  add column problem_type problem_kind not null default 'implementation',
  add column constraints text,
  -- Guidance for a future reviewer/AI mentor — never rendered directly to
  -- the learner as "the answer". See PROBLEM METADATA.
  add column solution_approach text,
  -- 1 (recognition) .. 5 (transfer) — see PROBLEM PROGRESSION. Cognitive
  -- difficulty within a skill, independent of `difficulty`, which is
  -- coarser and cross-skill.
  add column progression_level smallint not null default 1 check (progression_level between 1 and 5);

-- Per-language starter code. A problem "supports" whichever languages have
-- a row here — no separate supported_languages column needed.
create table problem_starter_code (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references problems (id) on delete cascade,
  language_id uuid not null references languages (id) on delete cascade,
  starter_code text not null,
  created_at timestamptz not null default now(),

  constraint unique_problem_language_starter unique (problem_id, language_id)
);

create index idx_problem_starter_code_problem on problem_starter_code (problem_id);

-- ---------------------------------------------------------------------
-- Mistake taxonomy — normalized, extensible (see COMMON MISTAKE SYSTEM).
-- Prompt 4's Mistake DNA reads this table; problem_common_mistakes
-- (Prompt 1) now optionally links to a taxonomy key instead of only
-- carrying free-text.
-- ---------------------------------------------------------------------
create table mistake_taxonomy (
  key text primary key, -- e.g. "OFF_BY_ONE", "INDEX_OUT_OF_RANGE"
  skill_id uuid references skills (id) on delete set null,
  title text not null,
  description text not null,
  created_at timestamptz not null default now()
);

alter table problem_common_mistakes
  add column mistake_key text references mistake_taxonomy (key) on delete set null;

-- ---------------------------------------------------------------------
-- Lesson & problem progress — simple completion state. NOT the mastery
-- engine (services/mastery owns that, Prompt 4 builds the real version).
-- This answers "has this user seen/finished this lesson/problem," which
-- the mastery score alone can't answer (e.g. a lesson has no score).
-- ---------------------------------------------------------------------
create type lesson_progress_status as enum ('in_progress', 'completed');

create table user_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  lesson_id uuid not null references lessons (id) on delete cascade,
  status lesson_progress_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  completed_at timestamptz,

  constraint unique_user_lesson_progress unique (user_id, lesson_id)
);

create index idx_user_lesson_progress_user on user_lesson_progress (user_id);

create type problem_progress_status as enum ('attempted', 'completed');

create table user_problem_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  problem_id uuid not null references problems (id) on delete cascade,
  status problem_progress_status not null default 'attempted',
  attempts_count integer not null default 1,
  first_attempted_at timestamptz not null default now(),
  completed_at timestamptz,

  constraint unique_user_problem_progress unique (user_id, problem_id)
);

create index idx_user_problem_progress_user on user_problem_progress (user_id);

-- Daily activity — foundation for a future streak, not the streak itself
-- (see STREAKS / GAMIFICATION: data structure only, no UI/gamification yet).
create table user_daily_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  activity_date date not null,
  event_count integer not null default 1,

  constraint unique_user_activity_date unique (user_id, activity_date)
);

create index idx_user_daily_activity_user on user_daily_activity (user_id, activity_date desc);

-- ---------------------------------------------------------------------
-- Learning events: new event types (additive — see LEARNING EVENTS)
-- ---------------------------------------------------------------------
alter type learning_event_type add value if not exists 'lesson_started';
alter type learning_event_type add value if not exists 'micro_check_started';
alter type learning_event_type add value if not exists 'micro_check_completed';
alter type learning_event_type add value if not exists 'problem_started';
alter type learning_event_type add value if not exists 'problem_attempted';
alter type learning_event_type add value if not exists 'problem_completed';
