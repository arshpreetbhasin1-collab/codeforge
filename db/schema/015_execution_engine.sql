-- CodeForge — Prompt 3: Execution Engine
--
-- Additive only, same discipline as db/schema/013 — nothing from prior
-- migrations is renamed or dropped. This adds what real code execution and
-- judging need: detailed verdict states, resource limits, per-test-case
-- comparison strategy, isolated SQL problem datasets, and the fields the
-- judge/execution provider actually produce.
--
-- Execution never happens inside Postgres itself for compiled/interpreted
-- languages — see lib/execution/. This migration only adds storage for the
-- *results* of execution that happens in an isolated external runner.

-- ---------------------------------------------------------------------
-- Detailed verdict states (see EXECUTION STATES). Additive to the enums
-- from db/schema/006_submissions.sql — old values ('passed','failed',
-- 'completed', ...) remain for backward compatibility but new code uses
-- these.
-- ---------------------------------------------------------------------
alter type submission_status add value if not exists 'accepted';
alter type submission_status add value if not exists 'wrong_answer';
alter type submission_status add value if not exists 'compile_error';
alter type submission_status add value if not exists 'runtime_error';
alter type submission_status add value if not exists 'time_limit_exceeded';
alter type submission_status add value if not exists 'memory_limit_exceeded';
alter type submission_status add value if not exists 'output_limit_exceeded';
alter type submission_status add value if not exists 'system_error';
alter type submission_status add value if not exists 'cancelled';

alter type run_status add value if not exists 'compile_error';
alter type run_status add value if not exists 'runtime_error';
alter type run_status add value if not exists 'time_limit_exceeded';
alter type run_status add value if not exists 'memory_limit_exceeded';
alter type run_status add value if not exists 'output_limit_exceeded';
alter type run_status add value if not exists 'system_error';

-- See LEARNING INTEGRATION: a verdict maps to a mistake-taxonomy-adjacent
-- learning event, not just pass/fail.
alter type learning_event_type add value if not exists 'compilation_mistake';
alter type learning_event_type add value if not exists 'runtime_mistake';
alter type learning_event_type add value if not exists 'efficiency_mistake';

-- ---------------------------------------------------------------------
-- Languages: provider wiring + execution-enabled flag. A language can
-- exist for content purposes (Prompt 2's JavaScript examples) without
-- being wired for real execution this phase — see LANGUAGE REGISTRY.
-- ---------------------------------------------------------------------
alter table languages
  add column provider_language_id text, -- e.g. "cpython-3.12.7" — opaque to the app, meaningful only to the provider
  add column execution_enabled boolean not null default false;

-- ---------------------------------------------------------------------
-- Problems: default resource limits (configurable per problem) and an
-- explicit flag distinguishing conceptual Prompt 2 problems from problems
-- with a real, verified stdin/stdout execution contract.
-- ---------------------------------------------------------------------
alter table problems
  add column time_limit_ms integer not null default 2000,
  add column memory_limit_mb integer not null default 128,
  add column is_executable boolean not null default false;

-- ---------------------------------------------------------------------
-- Test cases: comparison strategy + per-test overrides (see JUDGE ENGINE,
-- TEST CASE MODEL). Problem authors choose the strategy — nothing here
-- normalizes output automatically without an explicit mode.
-- ---------------------------------------------------------------------
create type comparison_mode as enum (
  'exact', -- byte-for-byte
  'trim', -- ignore leading/trailing whitespace on the whole output
  'normalize_whitespace', -- collapse internal whitespace runs, then trim
  'numeric_tolerance', -- compare as a single number within `numeric_tolerance`
  'unordered_lines', -- compare as a set of lines, ignoring order
  'unordered_rows' -- SQL only: compare as a set of rows, ignoring order
);

alter table problem_test_cases
  add column weight integer not null default 1,
  add column comparison_mode comparison_mode not null default 'trim',
  add column numeric_tolerance numeric,
  add column time_limit_ms integer, -- null = use problems.time_limit_ms
  add column memory_limit_mb integer; -- null = use problems.memory_limit_mb

-- ---------------------------------------------------------------------
-- SQL problem datasets — the isolated schema+data a SQL problem's queries
-- run against (see SQL and SQL PROBLEM DESIGN). Shown to the learner as
-- part of the problem statement, so public-read like other content.
-- ---------------------------------------------------------------------
create table sql_problem_datasets (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references problems (id) on delete cascade,
  schema_sql text not null, -- CREATE TABLE statements, run inside a throwaway schema
  seed_sql text not null, -- INSERT statements
  created_at timestamptz not null default now(),

  constraint unique_sql_dataset_per_problem unique (problem_id)
);

alter table sql_problem_datasets enable row level security;

create policy "sql_problem_datasets are publicly readable"
  on sql_problem_datasets for select
  using (true);

create policy "staff manage sql_problem_datasets"
  on sql_problem_datasets for all
  using (is_staff())
  with check (is_staff());

-- ---------------------------------------------------------------------
-- code_runs: visible-tests-only results, kept for audit/rate-limiting
-- (see SUBMIT VS RUN — Run is fast feedback, not an official attempt).
-- Per-test breakdown is small and non-secret (visible tests only), so it's
-- stored inline rather than needing a child table.
-- ---------------------------------------------------------------------
alter table code_runs
  add column test_results jsonb not null default '[]'::jsonb,
  add column execution_id text; -- short id shown to the user on system errors, see OBSERVABILITY

-- ---------------------------------------------------------------------
-- submissions / submission_results: the fields a real judge produces.
-- ---------------------------------------------------------------------
alter table submissions
  add column execution_id text;

alter table submission_results
  add column memory_kb integer,
  add column error_type text; -- short category: 'timeout' | 'runtime_error' | 'compile_error' | ...

-- ---------------------------------------------------------------------
-- user_problem_progress: last language used + a cached best result, so
-- the UI doesn't need to scan full submission history for a summary.
-- Still NOT the mastery engine — Prompt 4 owns scoring.
-- ---------------------------------------------------------------------
alter table user_problem_progress
  add column language_id uuid references languages (id) on delete set null,
  add column best_passed_test_count integer not null default 0,
  add column best_total_test_count integer not null default 0;
