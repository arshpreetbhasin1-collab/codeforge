-- CodeForge — Code Runs, Submissions & Evaluation Results
--
-- `code_runs` = "Run" (against visible examples only, not graded).
-- `submissions` = "Submit" (graded against the full test suite, including
-- hidden cases). Kept as separate tables because they have different
-- lifecycles and only submissions feed mastery/learning_events.
--
-- Execution itself is NOT implemented here — Prompt 3 owns the sandboxed
-- runner. This schema only records inputs/outputs of that process.

create type run_status as enum ('queued', 'running', 'completed', 'error', 'timeout');

create table code_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  problem_id uuid references problems (id) on delete cascade,
  language_id uuid not null references languages (id) on delete restrict,
  source_code text not null,
  stdin text,
  status run_status not null default 'queued',
  stdout text,
  stderr text,
  exit_code integer,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index idx_code_runs_user on code_runs (user_id);
create index idx_code_runs_problem on code_runs (problem_id);

create type submission_status as enum (
  'queued', 'running', 'passed', 'failed', 'error', 'timeout'
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  problem_id uuid not null references problems (id) on delete cascade,
  language_id uuid not null references languages (id) on delete restrict,
  source_code text not null,
  status submission_status not null default 'queued',
  passed_test_count integer not null default 0,
  total_test_count integer not null default 0,
  runtime_ms integer,
  memory_kb integer,
  hints_used_count smallint not null default 0,
  created_at timestamptz not null default now()
);

create index idx_submissions_user on submissions (user_id);
create index idx_submissions_problem on submissions (problem_id);
create index idx_submissions_user_problem on submissions (user_id, problem_id);

-- Per-test-case result for a submission — what the "code quality analysis"
-- and mistake-pattern matching (Prompt 4) actually reads.
create table submission_results (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions (id) on delete cascade,
  test_case_id uuid not null references problem_test_cases (id) on delete cascade,
  passed boolean not null,
  actual_output text,
  runtime_ms integer,
  error_message text,
  created_at timestamptz not null default now()
);

create index idx_submission_results_submission on submission_results (submission_id);
