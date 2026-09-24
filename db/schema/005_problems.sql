-- CodeForge — Problems
--
-- A problem is deliberately NOT {title, description, answer}. It carries
-- everything the adaptive engine and AI mentor need: which skills it
-- exercises, what mistakes are common, what complexity is expected, and a
-- graded set of hints — see PRODUCT ARCHITECTURE §DATA MODEL PRINCIPLES.
-- Content must be original — never copied from LeetCode or similar.

create type problem_difficulty as enum ('intro', 'easy', 'medium', 'hard', 'boss');

create table problems (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  statement text not null, -- markdown
  difficulty problem_difficulty not null,
  learning_objective text not null,
  expected_time_complexity text, -- e.g. "O(n)"
  expected_space_complexity text, -- e.g. "O(1)"
  is_boss_challenge boolean not null default false,
  is_published boolean not null default false,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_problems_difficulty on problems (difficulty);
create index idx_problems_published on problems (is_published);

create trigger problems_set_updated_at
  before update on problems
  for each row execute function set_updated_at();

-- A problem's prerequisite skills (what a student must already have) are
-- modeled the same way as the skill graph itself, via problem_skills below,
-- distinguished by `relationship`.
create type problem_skill_relationship as enum ('teaches', 'prerequisite');

create table problem_skills (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references problems (id) on delete cascade,
  skill_id uuid not null references skills (id) on delete cascade,
  relationship problem_skill_relationship not null default 'teaches',
  created_at timestamptz not null default now(),

  constraint unique_problem_skill unique (problem_id, skill_id, relationship)
);

create index idx_problem_skills_problem on problem_skills (problem_id);
create index idx_problem_skills_skill on problem_skills (skill_id);

-- Structured, per-problem knowledge that powers Mistake DNA (Prompt 4) and
-- the AI mentor (Prompt 5) — kept as rows, not prose, so they're matchable
-- against a submission's actual failure mode.
create table problem_common_mistakes (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references problems (id) on delete cascade,
  description text not null,
  detection_hint text, -- heuristic the evaluator can use to flag this mistake
  created_at timestamptz not null default now()
);

create index idx_problem_common_mistakes_problem on problem_common_mistakes (problem_id);

create table problem_test_cases (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references problems (id) on delete cascade,
  input text not null,
  expected_output text not null,
  is_hidden boolean not null default false, -- hidden = not shown to student, used on submit
  is_edge_case boolean not null default false,
  explanation text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_problem_test_cases_problem on problem_test_cases (problem_id);

-- Graded hint ladder (LEVEL 1..6, see AI SAFETY / EDUCATIONAL PRINCIPLE).
-- Content-authored hints live here; Prompt 5's AI mentor generates
-- additional dynamic hints and stores them in ai_messages instead.
create table hints (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references problems (id) on delete cascade,
  level smallint not null check (level between 1 and 6),
  content text not null,
  created_at timestamptz not null default now(),

  constraint unique_hint_level_per_problem unique (problem_id, level)
);

create index idx_hints_problem on hints (problem_id);
