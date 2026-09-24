-- Prompt 5: onboarding preferences. profiles already has
-- preferred_language_id (003) and onboarding_completed_at (002) — this
-- only adds the two new preference fields onboarding collects.
-- These are stored preferences/goals only, never used to fabricate
-- mastery — see ONBOARDING: "Do NOT use onboarding answers as fake
-- mastery." The real mastery engine (Prompt 4) is untouched by this.

create type experience_level as enum ('complete_beginner', 'beginner', 'intermediate', 'advanced');

create type learning_goal as enum (
  'learn_programming', 'master_dsa', 'interview_prep', 'improve_problem_solving', 'build_projects'
);

alter table profiles
  add column experience_level experience_level,
  add column learning_goal learning_goal;
