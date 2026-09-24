-- CodeForge — Prompt 7: Project-Based Learning Engine (domain model)
--
-- Additive only, same discipline as every prior migration — nothing from
-- db/schema/008_projects.sql is renamed or dropped. That migration shipped
-- the *readiness foundation* (projects.required_skills jsonb, read by
-- services/projects/get-project-readiness.ts) and a *manual, external-repo
-- review* submission shape (project_submissions.repository_url/
-- deployment_url/reviewer_notes + project_submission_status). Both keep
-- working. This migration adds the real relational model a project needs
-- to be an actual graded, multi-stage exercise judged by the SAME engine
-- Prompt 3 built for problems (lib/judge/, services/execution/judge.ts) —
-- see PROJECT ENGINE: "Do NOT create another execution system."
--
-- required_skills jsonb is superseded by the new project_skills table
-- below (a real FK relation, matching problem_skills' shape) but is left
-- in place rather than dropped — see ABSOLUTE RULES: "Do not delete
-- working architecture without justification." Nothing new reads it;
-- services/projects/get-project-readiness.ts is repointed at
-- project_skills in the next commit.

-- ---------------------------------------------------------------------
-- Skills a project requires (gate) or demonstrates (evidence target) —
-- see problem_skills (005_problems.sql) for the identical pattern. A
-- project can list the same skill under both relationships (e.g. it
-- requires baseline SQL and also deepens it).
-- ---------------------------------------------------------------------
create type project_skill_relationship as enum ('prerequisite', 'demonstrates');

create table project_skills (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  skill_id uuid not null references skills (id) on delete cascade,
  relationship project_skill_relationship not null,
  -- Only meaningful for relationship='prerequisite' — see READINESS SCORE.
  min_mastery_score numeric(5, 2) check (min_mastery_score is null or min_mastery_score between 0 and 100),
  min_confidence numeric(5, 2) check (min_confidence is null or min_confidence between 0 and 100),
  created_at timestamptz not null default now(),

  constraint unique_project_skill unique (project_id, skill_id, relationship)
);

create index idx_project_skills_project on project_skills (project_id);
create index idx_project_skills_skill on project_skills (skill_id);

-- ---------------------------------------------------------------------
-- Languages a project explicitly supports — see QUALITY BAR: "not every
-- project needs every language." Absence of a row = not offered; the app
-- must explain why and suggest the closest supported option rather than
-- silently failing.
-- ---------------------------------------------------------------------
create table project_languages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  language_id uuid not null references languages (id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint unique_project_language unique (project_id, language_id)
);

create index idx_project_languages_project on project_languages (project_id);

-- ---------------------------------------------------------------------
-- Projects: the brief content the detail page renders (see PROJECT BRIEF)
-- plus deterministic, per-project scoring configuration (see SCORING:
-- "configurable-per-project weighted scoring"). objectives/constraints/
-- examples are genuinely variable-shaped small lists — JSON is
-- appropriate here per DATA MODEL PRINCIPLES's "JSON only for flexible
-- metadata"; everything with real relational structure (skills, stages,
-- requirements, tests) gets its own table below instead.
-- ---------------------------------------------------------------------
alter table projects
  add column overview text not null default '',
  add column problem_statement text not null default '',
  add column why_it_matters text not null default '',
  add column objectives jsonb not null default '[]'::jsonb,
  add column constraints_list jsonb not null default '[]'::jsonb,
  add column examples jsonb not null default '[]'::jsonb,
  add column starter_instructions text not null default '',
  -- Keys must match the criteria a project_reviews.score_breakdown
  -- reports; validated at write time by lib/projects/scoring.ts, not by
  -- the database. Default matches the example weighting in PROJECT
  -- EVALUATION: Correctness 50 / Edge Cases 15 / Efficiency 15 /
  -- Code Quality 10 / Testing 10.
  add column scoring_weights jsonb not null default
    '{"correctness":50,"edgeCases":15,"efficiency":15,"codeQuality":10,"testing":10}'::jsonb,
  add column estimated_hours numeric(5, 1),
  add column is_featured boolean not null default false;

create index idx_projects_featured on projects (is_featured) where is_featured;

-- ---------------------------------------------------------------------
-- Stages: a project's milestones (see WORKSPACE: three-panel layout,
-- progress "stage X/Y"). Every published project needs at least one stage
-- — enforced by the publishing workflow (lib/projects/), not a DB
-- constraint, so a project can be authored incrementally.
-- ---------------------------------------------------------------------
create table project_stages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  slug text not null,
  title text not null,
  description text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),

  constraint unique_project_stage_slug unique (project_id, slug)
);

create index idx_project_stages_project on project_stages (project_id, sort_order);

-- Per-stage checklist a learner must satisfy — distinct from the
-- project-level project_requirements (008) which describes the overall
-- brief, not a single stage's exit criteria.
create table project_stage_requirements (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references project_stages (id) on delete cascade,
  description text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_project_stage_requirements_stage on project_stage_requirements (stage_id);

-- Per-learner, per-stage progress — the cheap-to-read index the dashboard
-- "stage X/Y" card and the workspace's resume behavior use. Mirrors
-- user_skill_progress / user_problem_progress's role (007, 015): a
-- lightweight projection, never the source of truth (learning_events is).
create type project_stage_status as enum ('not_started', 'in_progress', 'completed');

create table project_stage_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  stage_id uuid not null references project_stages (id) on delete cascade,
  status project_stage_status not null default 'not_started',
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint unique_user_stage unique (user_id, stage_id)
);

create index idx_project_stage_progress_user_project on project_stage_progress (user_id, project_id);

create trigger project_stage_progress_set_updated_at
  before update on project_stage_progress
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Coarse per-project progress index — what the dashboard's "Current
-- Project" card reads without scanning submission history. Verdict here
-- is the outcome axis (see EVALUATION VERDICTS); it's deliberately
-- separate from project_submissions.status (the legacy manual-review
-- workflow state), since a project can be mid-workflow on one axis and
-- have a real graded verdict on the other.
-- ---------------------------------------------------------------------
create type project_verdict as enum ('not_started', 'in_progress', 'passed', 'needs_improvement', 'failed');

create table user_project_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  verdict project_verdict not null default 'not_started',
  best_score numeric(5, 2) check (best_score is null or best_score between 0 and 100),
  current_stage_id uuid references project_stages (id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint unique_user_project_progress unique (user_id, project_id)
);

create index idx_user_project_progress_user on user_project_progress (user_id);

create trigger user_project_progress_set_updated_at
  before update on user_project_progress
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- project_submissions: extended into a real per-attempt graded record.
-- The unique_user_project constraint from 008 assumed one row per learner
-- per project (fitting the old single manual review); that assumption no
-- longer holds once a project has multiple stages and retries, so it is
-- replaced with a non-unique index. Every column 008 added
-- (repository_url, deployment_url, reviewer_notes, status) is untouched
-- and still serves the external-repo manual-review path — see ABSOLUTE
-- RULES: "extend, never duplicate." New columns below serve the
-- automated-judge path (see SUBMISSION FLOW), reusing submissions'
-- (006_submissions.sql) exact column shape so the judge/scoring code
-- barely differs between grading a problem and grading a project stage.
-- ---------------------------------------------------------------------
alter table project_submissions drop constraint unique_user_project;

create index idx_project_submissions_user_project on project_submissions (user_id, project_id);

alter table project_submissions
  add column stage_id uuid references project_stages (id) on delete set null,
  add column attempt_number integer not null default 1,
  add column language_id uuid references languages (id) on delete restrict,
  add column source_code text,
  add column verdict project_verdict,
  add column score numeric(5, 2) check (score is null or score between 0 and 100),
  -- Per-criterion breakdown, keys matching projects.scoring_weights — see
  -- SCORING: "AI must never determine the core correctness score." Only
  -- the deterministic judge/scorer (lib/projects/scoring.ts) writes this.
  add column score_breakdown jsonb,
  add column passed_test_count integer not null default 0,
  add column total_test_count integer not null default 0,
  add column runtime_ms integer,
  add column memory_kb integer,
  add column execution_id text,
  add column compile_output text;

create index idx_project_submissions_stage on project_submissions (stage_id);

-- ---------------------------------------------------------------------
-- project_test_cases / project_test_results: the exact shape of
-- problem_test_cases / submission_results (005, 006, extended by 015) so
-- services/execution/judge.ts's runJudge() grades a project stage with
-- zero new execution code — only the row source changes. Always
-- stage-scoped: a project's "final" tests just live on its last stage.
-- ---------------------------------------------------------------------
create table project_test_cases (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references project_stages (id) on delete cascade,
  input text not null,
  expected_output text not null,
  is_hidden boolean not null default false,
  is_edge_case boolean not null default false,
  explanation text,
  weight integer not null default 1,
  comparison_mode comparison_mode not null default 'trim',
  numeric_tolerance numeric,
  time_limit_ms integer,
  memory_limit_mb integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_project_test_cases_stage on project_test_cases (stage_id);

create table project_test_results (
  id uuid primary key default gen_random_uuid(),
  project_submission_id uuid not null references project_submissions (id) on delete cascade,
  test_case_id uuid not null references project_test_cases (id) on delete cascade,
  passed boolean not null,
  actual_output text,
  runtime_ms integer,
  memory_kb integer,
  error_type text,
  stderr text,
  created_at timestamptz not null default now()
);

create index idx_project_test_results_submission on project_test_results (project_submission_id);

-- SQL-language projects need an isolated dataset per stage — mirrors
-- sql_problem_datasets (015) exactly, scoped to project_stages instead of
-- problems, so services/execution/sql-sandbox.ts needs no new code path.
create table project_sql_datasets (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references project_stages (id) on delete cascade,
  schema_sql text not null,
  seed_sql text not null,
  created_at timestamptz not null default now(),

  constraint unique_sql_dataset_per_stage unique (stage_id)
);

-- ---------------------------------------------------------------------
-- project_reviews: the post-submission report (see PROJECT REVIEW).
-- Deterministic fields (score/verdict/skills_demonstrated/mistake links)
-- are computed the same way project_submissions' own score is; ai_summary
-- is free-text AI commentary kept in its own column specifically so it is
-- never confused with — or allowed to influence — the deterministic
-- fields alongside it. One review per submission.
-- ---------------------------------------------------------------------
create table project_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  project_submission_id uuid not null references project_submissions (id) on delete cascade,
  overall_score numeric(5, 2) not null check (overall_score between 0 and 100),
  score_breakdown jsonb not null,
  verdict project_verdict not null,
  strengths jsonb not null default '[]'::jsonb,
  weaknesses jsonb not null default '[]'::jsonb,
  skills_demonstrated jsonb not null default '[]'::jsonb,
  complexity_assessment text,
  testing_assessment text,
  next_recommended_action text,
  -- Clearly-labeled AI commentary — see AI SAFETY: "AI commentary clearly
  -- labeled as AI and kept separate from deterministic test results."
  -- Null when no AI provider is configured; the review is still valid and
  -- complete without it (see NO FAKE FUNCTIONALITY).
  ai_summary text,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint unique_review_per_submission unique (project_submission_id)
);

create index idx_project_reviews_user on project_reviews (user_id);
create index idx_project_reviews_project on project_reviews (project_id);

-- ---------------------------------------------------------------------
-- Portfolio foundation only (see PORTFOLIO): durable evidence of a
-- completed project, for a later prompt's full portfolio UI to read.
-- Written once per passing review; never mutated to fabricate a better
-- outcome later — see DATA INTEGRITY: "historical reviews must not
-- silently change."
-- ---------------------------------------------------------------------
create table project_portfolio_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  project_submission_id uuid not null references project_submissions (id) on delete cascade,
  project_review_id uuid not null references project_reviews (id) on delete cascade,
  score numeric(5, 2) not null check (score between 0 and 100),
  skills_demonstrated jsonb not null default '[]'::jsonb,
  language_slug text not null,
  difficulty project_difficulty not null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_project_portfolio_entries_user on project_portfolio_entries (user_id);

-- ---------------------------------------------------------------------
-- mistake_events (016_adaptive_learning.sql): extended, not duplicated,
-- to also accept project-submission evidence — see MISTAKE DNA REUSE:
-- "reuse the existing 20-category taxonomy." submission_id becomes
-- optional and a project_submission_id sibling is added; exactly one of
-- the two must be set, so every row is still unambiguously "evidence from
-- one specific submission," problem or project.
-- ---------------------------------------------------------------------
alter table mistake_events alter column submission_id drop not null;

alter table mistake_events
  add column project_submission_id uuid references project_submissions (id) on delete cascade,
  add column project_id uuid references projects (id) on delete cascade;

alter table mistake_events
  add constraint mistake_events_exactly_one_source check (
    (submission_id is not null and project_submission_id is null)
    or (submission_id is null and project_submission_id is not null)
  );

create index idx_mistake_events_project_submission on mistake_events (project_submission_id);

-- Only 2 genuinely new categories beyond the existing 20 — see MISTAKE
-- REUSE: everything else a project can fail on (logic, edge cases,
-- runtime, complexity, SQL, input validation) already has a category.
alter type mistake_category add value if not exists 'architecture_error';
alter type mistake_category add value if not exists 'testing_gap';

-- ---------------------------------------------------------------------
-- learning_events (007_progress_and_mastery.sql): project_started and
-- project_completed already exist. Add the rest of the project lifecycle
-- (see LEARNING EVENTS) plus the FK columns needed to attribute a project
-- event to a specific project/submission — mirrors how 015 added
-- compilation_mistake/etc. to the same enum rather than a parallel table.
-- ---------------------------------------------------------------------
alter type learning_event_type add value if not exists 'project_stage_started';
alter type learning_event_type add value if not exists 'project_stage_completed';
alter type learning_event_type add value if not exists 'project_test_run';
alter type learning_event_type add value if not exists 'project_submitted';
alter type learning_event_type add value if not exists 'project_passed';
alter type learning_event_type add value if not exists 'project_failed';
alter type learning_event_type add value if not exists 'project_reviewed';

alter table learning_events
  add column project_id uuid references projects (id) on delete set null,
  add column project_submission_id uuid references project_submissions (id) on delete set null;

create index idx_learning_events_project on learning_events (project_id) where project_id is not null;
