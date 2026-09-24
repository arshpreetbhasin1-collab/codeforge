-- CodeForge — Prompt 4: Adaptive Learning Engine
--
-- Additive only, same discipline as every prior migration. This
-- deliberately does NOT duplicate what Prompt 1 already built:
-- `skill_mastery`, `mistake_patterns`, `review_sessions`, and
-- `user_skill_progress` already exist and are reused as-is (only
-- `skill_mastery` gains one new column). The only genuinely new
-- structure this prompt needs is an immutable, queryable log of
-- classified mistakes per submission — `mistake_patterns` is an
-- aggregate rollup, but nothing before this migration recorded the
-- individual classified events that rollup is built from.
--
-- Mastery itself is NOT stored as a new/duplicate table — it is derived
-- on demand from submissions + submission_results + learning_events
-- (all already immutable) and cached into the existing skill_mastery
-- row per (user, skill), recalculated by services/mastery/ targeted at
-- just the skills a new submission actually touches.

-- ---------------------------------------------------------------------
-- Mistake taxonomy for submission-level classification (see MISTAKE DNA).
-- Distinct from db/schema/013's `mistake_taxonomy` table, which holds
-- problem-authored "commonly, learners get this wrong" hints (content,
-- not evidence). This enum classifies what actually happened in one
-- specific submission.
-- ---------------------------------------------------------------------
create type mistake_category as enum (
  'compilation_error',
  'syntax_error',
  'type_error',
  'runtime_error',
  'time_limit',
  'output_limit',
  'wrong_answer',
  'edge_case_failure',
  'logic_error',
  'off_by_one',
  'boundary_error',
  'input_handling',
  'output_format',
  'data_structure_misuse',
  'algorithm_selection',
  'time_complexity',
  'space_complexity',
  'sql_query_error',
  'sql_schema_error',
  'unknown'
);

create type mistake_confidence as enum ('low', 'medium', 'high');

-- One row per classified mistake on one submission. Never updated after
-- insert — see IMMUTABLE EVIDENCE. `mistake_patterns` (Prompt 1) is the
-- maintained aggregate rollup on top of this log; skill attribution for
-- pattern queries happens via problem_skills at read time rather than
-- duplicating a row per skill a problem teaches.
create table mistake_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  submission_id uuid not null references submissions (id) on delete cascade,
  problem_id uuid not null references problems (id) on delete cascade,
  category mistake_category not null,
  confidence mistake_confidence not null,
  -- Short, factual note supporting the classification (e.g. the judge's
  -- error_type, or a matched keyword) — never the full raw compiler/
  -- runtime output. See OBSERVABILITY: evidence, not a data dump.
  evidence text,
  detected_at timestamptz not null default now()
);

create index idx_mistake_events_user on mistake_events (user_id);
create index idx_mistake_events_user_category on mistake_events (user_id, category);
create index idx_mistake_events_problem on mistake_events (problem_id);
create index idx_mistake_events_submission on mistake_events (submission_id);

alter table mistake_events enable row level security;

create policy "users manage own mistake_events"
  on mistake_events for all
  using (auth.uid() = user_id or is_staff())
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- skill_mastery: one new column. `mastery_score` already represents
-- "guided" mastery (hint-assisted successes still count, discounted).
-- `independent_score` is the same evidence restricted to hint-free
-- attempts — see INDEPENDENCE SCORE. Nullable: meaningfully different
-- from 0, which would falsely claim "confirmed no independent ability"
-- when the honest answer is "not enough hint-free evidence yet."
-- ---------------------------------------------------------------------
alter table skill_mastery
  add column independent_score numeric(5, 2) check (independent_score is null or independent_score between 0 and 100);
