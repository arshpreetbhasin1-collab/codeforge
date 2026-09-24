-- CodeForge — GitHub Integration & Deployment (Prompt 7 storage shape)

create table github_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  github_username text not null,
  access_token_encrypted text not null, -- encrypted at rest; never selected to the client
  connected_at timestamptz not null default now(),

  constraint unique_user_github unique (user_id)
);

create type deployment_status as enum ('pending', 'building', 'live', 'failed');

create table deployments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  project_submission_id uuid references project_submissions (id) on delete cascade,
  provider text not null, -- e.g. "vercel"
  status deployment_status not null default 'pending',
  url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_deployments_user on deployments (user_id);

create trigger deployments_set_updated_at
  before update on deployments
  for each row execute function set_updated_at();
