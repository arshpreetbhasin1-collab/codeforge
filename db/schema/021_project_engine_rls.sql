-- CodeForge — Prompt 7: Row Level Security for the project engine
--
-- Same two-class discipline as 012_rls.sql: content tables (public read,
-- staff write) vs user-owned tables (owner + staff only). Hidden project
-- tests follow problem_test_cases' exact pattern — never directly
-- readable by students, only by the service-role client during grading.

-- ---------------------------------------------------------------------
-- Content tables: public read, staff write
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'project_skills', 'project_languages', 'project_stages',
    'project_stage_requirements', 'project_sql_datasets'
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

-- project_test_cases: hidden cases are never readable by students
-- directly — only the evaluation service (service-role key, bypasses
-- RLS) reads them during grading. Mirrors problem_test_cases exactly.
alter table project_test_cases enable row level security;

create policy "visible project test cases are publicly readable"
  on project_test_cases for select
  using (not is_hidden or is_staff());

create policy "staff manage project_test_cases"
  on project_test_cases for all
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
    'project_stage_progress', 'user_project_progress',
    'project_reviews', 'project_portfolio_entries'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "users manage own %1$s" on %1$I for all using (auth.uid() = user_id or is_staff()) with check (auth.uid() = user_id)',
      t
    );
  end loop;
end $$;

-- project_test_results: owned indirectly via project_submissions.user_id
-- — mirrors submission_results' policy exactly.
alter table project_test_results enable row level security;

create policy "users read own project_test_results"
  on project_test_results for select
  using (
    is_staff()
    or exists (
      select 1 from project_submissions
      where project_submissions.id = project_test_results.project_submission_id
        and project_submissions.user_id = auth.uid()
    )
  );
