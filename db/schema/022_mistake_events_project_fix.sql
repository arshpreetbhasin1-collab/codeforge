-- CodeForge — Prompt 7 fix: mistake_events.problem_id must also be
-- nullable for project-sourced rows.
--
-- 020_project_engine.sql relaxed submission_id to nullable and added the
-- exactly-one-source check, but missed that problem_id (016_adaptive_learning.sql)
-- was ALSO `not null` — a project mistake event (project_submission_id set,
-- submission_id null) has no problem_id either, so inserting one would
-- have failed this leftover constraint. Additive fix, no data affected
-- (every existing row already has both submission_id and problem_id set).

alter table mistake_events alter column problem_id drop not null;
