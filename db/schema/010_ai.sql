-- CodeForge — AI Conversations
--
-- Storage shape for lib/ai/provider.ts consumers. One conversation always
-- has exactly one `capability` (mentor | hint | code_review | explanation |
-- interviewer | project_review) — see AI ARCHITECTURE. This is intentionally
-- NOT one giant "ask AI" log: capability lets later prompts query, rate-limit,
-- and evaluate each use case independently.

create type ai_capability as enum (
  'mentor', 'hint', 'code_review', 'explanation', 'interviewer', 'project_review'
);

create table ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  capability ai_capability not null,
  problem_id uuid references problems (id) on delete set null,
  project_id uuid references projects (id) on delete set null,
  interview_session_id uuid references interview_sessions (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_ai_conversations_user on ai_conversations (user_id);
create index idx_ai_conversations_capability on ai_conversations (capability);

create type ai_message_role as enum ('system', 'user', 'assistant');

create table ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations (id) on delete cascade,
  role ai_message_role not null,
  content text not null,
  hint_level smallint check (hint_level between 1 and 6), -- set only for capability='hint'
  provider text, -- which AI provider served this message
  model text,
  created_at timestamptz not null default now()
);

create index idx_ai_messages_conversation on ai_messages (conversation_id);
