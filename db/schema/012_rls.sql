-- CodeForge — Row Level Security
--
-- Two classes of table:
--  1. Content tables (languages, skills, curricula, problems, ...) — readable
--     by anyone, writable only by admin/mentor. Public signup can never
--     create an admin/mentor profile (enforced below in `profiles` policies),
--     so this is a real boundary, not a client-side convention.
--  2. User-owned tables (submissions, learning_events, skill_mastery, ...) —
--     readable/writable only by the owning user, plus admin/mentor read.

create function current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create function is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(current_user_role() in ('admin', 'mentor'), false);
$$;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
alter table profiles enable row level security;

create policy "profiles are publicly readable"
  on profiles for select
  using (true);

create policy "users can update their own profile"
  on profiles for update
  using (auth.uid() = id)
  -- A user can edit their own display fields, but never their own role —
  -- the WITH CHECK re-reads the row being written and rejects any change
  -- where the new role differs from the role already on record.
  with check (auth.uid() = id and role = (select role from profiles where id = auth.uid()));

-- ---------------------------------------------------------------------
-- Content tables: public read, staff write
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'languages', 'skills', 'skill_dependencies',
    'curricula', 'modules', 'lessons', 'concepts',
    'problems', 'problem_skills', 'problem_common_mistakes', 'hints',
    'projects', 'project_requirements'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "%1$s are publicly readable" on %1$I for select using (true)', t
    );
    execute format(
      'create policy "staff manage %1$s" on %1$I for all using (is_staff()) with check (is_staff())', t
    );
  end loop;
end $$;

-- problem_test_cases: hidden cases are never readable by students directly —
-- only the evaluation service (via service-role key, which bypasses RLS)
-- may read them during grading.
alter table problem_test_cases enable row level security;

create policy "visible test cases are publicly readable"
  on problem_test_cases for select
  using (not is_hidden or is_staff());

create policy "staff manage problem_test_cases"
  on problem_test_cases for all
  using (is_staff())
  with check (is_staff());

-- ---------------------------------------------------------------------
-- User-owned tables: owner + staff only
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'code_runs', 'submissions', 'user_skill_progress', 'skill_mastery',
    'mistake_patterns', 'learning_events', 'review_sessions',
    'project_submissions', 'interview_sessions', 'achievements',
    'notifications', 'ai_conversations', 'github_connections', 'deployments'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "users manage own %1$s" on %1$I for all using (auth.uid() = user_id or is_staff()) with check (auth.uid() = user_id)',
      t
    );
  end loop;
end $$;

-- submission_results: owned indirectly via submissions.user_id.
alter table submission_results enable row level security;

create policy "users read own submission_results"
  on submission_results for select
  using (
    is_staff()
    or exists (
      select 1 from submissions
      where submissions.id = submission_results.submission_id
        and submissions.user_id = auth.uid()
    )
  );

-- ai_messages: owned indirectly via ai_conversations.user_id.
alter table ai_messages enable row level security;

create policy "users manage own ai_messages"
  on ai_messages for all
  using (
    is_staff()
    or exists (
      select 1 from ai_conversations
      where ai_conversations.id = ai_messages.conversation_id
        and ai_conversations.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from ai_conversations
      where ai_conversations.id = ai_messages.conversation_id
        and ai_conversations.user_id = auth.uid()
    )
  );
