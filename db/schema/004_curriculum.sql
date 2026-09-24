-- CodeForge — Curriculum: curricula → modules → lessons → concepts
--
-- A `curriculum` is language-scoped (e.g. "Python Foundations"). It is a
-- *default ordering*, not a rigid path — `lib/learning/path.ts` is what
-- actually decides a given student's next step, using this as a fallback
-- graph rather than a forced sequence.

create table curricula (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null,
  language_id uuid not null references languages (id) on delete cascade,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_curricula_language on curricula (language_id);

create table modules (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references curricula (id) on delete cascade,
  slug text not null,
  title text not null,
  description text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),

  constraint unique_module_slug_per_curriculum unique (curriculum_id, slug)
);

create index idx_modules_curriculum on modules (curriculum_id);

-- A `concept` is the reusable unit of "what this teaches" — a lesson
-- delivers one concept; a problem targets one or more concepts via
-- `problem_skills`. Kept separate from `skills` because a concept is
-- teaching content, while a skill is a masterable, gradable capability.
create table concepts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  skill_id uuid references skills (id) on delete set null,
  created_at timestamptz not null default now()
);

-- One-page lesson: WHY / WHAT / HOW / EXAMPLE / COMMON MISTAKE / MICRO CHALLENGE.
-- Stored as discrete columns (not one markdown blob) so the UI can render each
-- section consistently and the AI mentor can reference a specific section.
create table lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references modules (id) on delete cascade,
  concept_id uuid references concepts (id) on delete set null,
  slug text not null,
  title text not null,
  why text not null,
  what text not null,
  how text not null,
  example_code text not null,
  example_language_id uuid references languages (id) on delete set null,
  common_mistake text not null,
  micro_challenge_prompt text not null,
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint unique_lesson_slug_per_module unique (module_id, slug)
);

create index idx_lessons_module on lessons (module_id);
create index idx_lessons_concept on lessons (concept_id);

create trigger lessons_set_updated_at
  before update on lessons
  for each row execute function set_updated_at();
