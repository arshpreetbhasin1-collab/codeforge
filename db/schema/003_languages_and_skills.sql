-- CodeForge — Language Registry & Skill Graph
--
-- `languages` is the data backing of the language registry described in
-- lib/problems/language-registry.ts. It intentionally does not assume every
-- language shares an execution strategy — `execution_provider` lets Prompt 3
-- route each language to a different sandboxed runner.
--
-- `skills` + `skill_dependencies` form the Skill Graph: a DAG (not a tree —
-- a skill may have multiple prerequisites) that the adaptive engine (Prompt 4)
-- walks to decide what a student is ready to learn next.

create table languages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique, -- e.g. 'python', 'javascript'
  display_name text not null,
  version text not null,
  file_extension text not null,
  syntax_highlighter text not null, -- Monaco language id
  execution_provider text not null, -- resolved by lib/problems/language-registry.ts
  compile_command text,
  run_command text not null,
  timeout_ms integer not null default 5000,
  memory_limit_mb integer not null default 256,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table profiles
  add constraint profiles_preferred_language_fk
  foreign key (preferred_language_id) references languages (id) on delete set null;

create type skill_category as enum (
  'foundations',
  'control_flow',
  'functions',
  'data_structures',
  'algorithms',
  'complexity',
  'debugging',
  'system_design',
  'databases',
  'web',
  'testing'
);

create table skills (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  category skill_category not null,
  language_id uuid references languages (id) on delete cascade, -- null = language-agnostic skill
  difficulty smallint not null default 1 check (difficulty between 1 and 5),
  created_at timestamptz not null default now()
);

create index idx_skills_category on skills (category);
create index idx_skills_language on skills (language_id);

-- Edge list for the Skill Graph DAG: `skill_id` requires `prerequisite_skill_id`.
create table skill_dependencies (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references skills (id) on delete cascade,
  prerequisite_skill_id uuid not null references skills (id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint no_self_dependency check (skill_id <> prerequisite_skill_id),
  constraint unique_dependency unique (skill_id, prerequisite_skill_id)
);

create index idx_skill_dependencies_skill on skill_dependencies (skill_id);
create index idx_skill_dependencies_prereq on skill_dependencies (prerequisite_skill_id);
