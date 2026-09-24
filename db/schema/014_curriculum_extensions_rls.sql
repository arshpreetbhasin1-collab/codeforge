-- CodeForge — RLS for Prompt 2 tables. Same two-class model as
-- db/schema/012_rls.sql: content tables are public-read/staff-write,
-- user-owned tables are owner-scoped (+ staff).

do $$
declare
  t text;
begin
  foreach t in array array[
    'lesson_code_examples', 'micro_checks', 'problem_starter_code', 'mistake_taxonomy'
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

do $$
declare
  t text;
begin
  foreach t in array array[
    'user_lesson_progress', 'user_problem_progress', 'user_daily_activity'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "users manage own %1$s" on %1$I for all using (auth.uid() = user_id or is_staff()) with check (auth.uid() = user_id)',
      t
    );
  end loop;
end $$;

-- user_micro_check_attempts: owned directly via user_id, but a select
-- policy alone won't do — an attempt, once recorded, shouldn't be
-- editable (it's a log entry), so this only allows insert + select, not
-- update/delete, even by the owner.
alter table user_micro_check_attempts enable row level security;

create policy "users read own micro_check_attempts"
  on user_micro_check_attempts for select
  using (auth.uid() = user_id or is_staff());

create policy "users record own micro_check_attempts"
  on user_micro_check_attempts for insert
  with check (auth.uid() = user_id);
