-- CodeForge — Projects (Learning → Project readiness)
--
-- Full project evaluation is a Prompt 6 concern. This is the data shape
-- projects need to exist and be *recommended* once a student's skill_mastery
-- crosses the thresholds in `required_skills`.

create type project_difficulty as enum ('beginner', 'intermediate', 'advanced');

create table projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null,
  difficulty project_difficulty not null,
  required_skills jsonb not null default '[]'::jsonb, -- [{ skill_id, min_mastery_score }]
  starter_repo_url text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger projects_set_updated_at
  before update on projects
  for each row execute function set_updated_at();

create table project_requirements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  title text not null,
  description text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_project_requirements_project on project_requirements (project_id);

create type project_submission_status as enum (
  'not_started', 'in_progress', 'submitted', 'under_review', 'approved', 'changes_requested'
);

create table project_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  status project_submission_status not null default 'not_started',
  repository_url text,
  deployment_url text,
  reviewer_notes text,
  started_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint unique_user_project unique (user_id, project_id)
);

create index idx_project_submissions_user on project_submissions (user_id);
create index idx_project_submissions_project on project_submissions (project_id);

create trigger project_submissions_set_updated_at
  before update on project_submissions
  for each row execute function set_updated_at();
