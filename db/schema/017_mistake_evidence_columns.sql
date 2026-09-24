-- Prompt 4: mistake classification (lib/mistakes/classifier.ts) needs the
-- raw compiler/runtime error text, but submit-code.ts previously only
-- returned it to the client for that one request and never persisted it.
-- Without these columns, a backfill utility could reconstruct wrong_answer
-- mistakes (submission_results already has everything needed) but not
-- compile_error/runtime_error ones — see MISTAKE DNA: "evidence-based,
-- never guessed." Additive only, nothing existing changes shape.

alter table submissions
  add column compile_output text;

alter table submission_results
  add column stderr text;
