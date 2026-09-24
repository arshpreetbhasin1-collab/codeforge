import "server-only";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { codeSubmissionSchema, type CodeSubmissionInput } from "@/lib/validation/schemas";
import { getExecutableLanguage } from "@/lib/execution/registry";
import { generateExecutionId } from "@/lib/execution/execution-id";
import { runJudge, type JudgeTestCase } from "./judge";
import { resolveLanguageId, enforceRateLimit } from "./run-code";
import { recordProblemProgress } from "@/services/learning/record-problem-progress";
import { recordLearningEvent } from "@/services/learning/record-learning-event";
import { deriveVerdictFromOutcomes, type Verdict } from "@/lib/judge/verdicts";
import type { ComparisonMode } from "@/types/domain";
import { classifyAndRecordMistake } from "@/services/mistakes/classify-and-record-mistake";
import { timelineMistakeEventType } from "@/lib/mistakes/taxonomy";
import { recalculateSkillMastery, getSkillIdsTaughtByProblem } from "@/services/mastery/recalculate-skill-mastery";

export interface SubmitCodeResult {
  submissionId: string;
  verdict: Verdict;
  passedCount: number;
  totalCount: number;
  runtimeMs: number | null;
  memoryKb: number | null;
  compileOutput: string | null;
  /** Only visible-test detail — hidden test bodies never leave the server. See HIDDEN TESTS. */
  visibleResults: {
    testCaseId: string;
    passed: boolean;
    input: string;
    expectedOutput: string;
    actualOutput: string;
  }[];
  hiddenSummary: { passed: number; total: number };
  executionId: string;
}

interface TestCaseRow {
  id: string;
  input: string;
  expected_output: string;
  is_hidden: boolean;
  is_edge_case: boolean;
  weight: number;
  comparison_mode: ComparisonMode;
  numeric_tolerance: number | null;
  time_limit_ms: number | null;
  memory_limit_mb: number | null;
}

/**
 * SUBMIT: the official attempt — visible + hidden tests, a persisted
 * submission record, a learning event, and a progress update. Uses the
 * service-role client because grading requires reading hidden test cases,
 * which RLS (db/schema/012_rls.sql) correctly denies to the student's own
 * session — see HIDDEN TESTS: "the frontend must not receive hidden
 * inputs/expected outputs/solutions before submission." The caller
 * (a Server Action) has already authenticated `userId` from the real
 * session before this runs — this function never trusts a client-supplied
 * user id.
 */
export async function submitCode(
  userSupabase: SupabaseClient,
  userId: string,
  input: CodeSubmissionInput,
): Promise<SubmitCodeResult> {
  const parsed = codeSubmissionSchema.parse(input);
  const executionId = generateExecutionId();

  const language = getExecutableLanguage(parsed.languageSlug);
  if (!language) {
    throw new Error(`Language "${parsed.languageSlug}" is not wired for execution.`);
  }

  // Rate-limited against the user's own session client — RLS still scopes
  // this to their own submissions regardless of which client reads it.
  await enforceRateLimit(userSupabase, userId, "submissions");

  const admin = createSupabaseAdminClient();

  const { data: problem } = await admin
    .from("problems")
    .select("id, time_limit_ms, memory_limit_mb, is_executable")
    .eq("id", parsed.problemId)
    .eq("is_published", true)
    .maybeSingle();

  if (!problem || !problem.is_executable) {
    throw new Error("This problem is not set up for execution.");
  }

  const { data: testCaseRows } = await admin
    .from("problem_test_cases")
    .select(
      "id, input, expected_output, is_hidden, is_edge_case, weight, comparison_mode, numeric_tolerance, time_limit_ms, memory_limit_mb",
    )
    .eq("problem_id", problem.id)
    .order("sort_order", { ascending: true });

  const rows = (testCaseRows as TestCaseRow[]) ?? [];
  if (rows.length === 0) {
    throw new Error("This problem has no test cases configured.");
  }

  const testCases: JudgeTestCase[] = rows.map((row) => ({
    id: row.id,
    input: row.input,
    expectedOutput: row.expected_output,
    comparisonMode: row.comparison_mode,
    numericTolerance: row.numeric_tolerance,
    timeLimitMs: row.time_limit_ms,
    memoryLimitMb: row.memory_limit_mb,
  }));

  let sqlDataset: { schemaSql: string; seedSql: string } | undefined;
  if (parsed.languageSlug === "sql") {
    const { data: dataset } = await admin
      .from("sql_problem_datasets")
      .select("schema_sql, seed_sql")
      .eq("problem_id", problem.id)
      .maybeSingle();
    if (!dataset) throw new Error("This SQL problem has no dataset configured.");
    sqlDataset = { schemaSql: dataset.schema_sql, seedSql: dataset.seed_sql };
  }

  const judgeResult = await runJudge({
    languageSlug: parsed.languageSlug,
    sourceCode: parsed.sourceCode,
    testCases,
    problemLimits: {
      timeLimitMs: problem.time_limit_ms,
      memoryLimitMb: problem.memory_limit_mb,
      outputLimitBytes: 64 * 1024,
    },
    sqlDataset,
  });

  const passedCount = judgeResult.outcomes.filter((o) => o.passed).length;
  const totalCount = testCases.length;
  const verdict: Verdict = judgeResult.preTestFailure
    ? judgeResult.preTestFailure.verdict
    : deriveVerdictFromOutcomes(judgeResult.outcomes);

  const runtimeMs = judgeResult.outcomes.length > 0 ? Math.max(...judgeResult.outcomes.map((o) => o.runtimeMs ?? 0)) : null;
  const memoryKb = judgeResult.outcomes.find((o) => o.memoryUsedKb !== null)?.memoryUsedKb ?? null;
  const languageId = await resolveLanguageId(admin, parsed.languageSlug);
  const hintsUsedCount = await countHintsUsed(admin, userId, problem.id);

  const { data: submission, error: submissionError } = await admin
    .from("submissions")
    .insert({
      user_id: userId,
      problem_id: problem.id,
      language_id: languageId,
      source_code: parsed.sourceCode,
      status: verdict,
      passed_test_count: passedCount,
      total_test_count: totalCount,
      runtime_ms: runtimeMs,
      memory_kb: memoryKb,
      hints_used_count: hintsUsedCount,
      execution_id: executionId,
      compile_output: judgeResult.preTestFailure?.compileOutput ?? null,
    })
    .select("id")
    .single();

  if (submissionError || !submission) {
    throw new Error("Failed to record submission.");
  }

  if (judgeResult.outcomes.length > 0) {
    await admin.from("submission_results").insert(
      judgeResult.outcomes.map((outcome) => ({
        submission_id: submission.id,
        test_case_id: outcome.testCaseId,
        passed: outcome.passed,
        actual_output: outcome.actualOutput,
        runtime_ms: outcome.runtimeMs,
        memory_kb: outcome.memoryUsedKb,
        error_type: outcome.errorType,
        stderr: outcome.stderr,
      })),
    );
  }

  await recordProblemProgress(userSupabase, userId, problem.id, verdict === "accepted" ? "completed" : "attempted", {
    languageId,
    passedTestCount: passedCount,
    totalTestCount: totalCount,
  });

  // Classify this submission's mistake (if any), recalculate mastery for
  // every skill this problem teaches, and log a coarse timeline event
  // driven by the SAME classification — see ADAPTIVE LEARNING ENGINE /
  // IMMUTABLE EVIDENCE. Runs on the admin client since it needs the same
  // hidden-test visibility as grading; failures here must never fail the
  // submission itself (the learner's result already succeeded).
  try {
    const classification = await classifyAndRecordMistake(admin, {
      userId,
      submissionId: submission.id,
      problemId: problem.id,
      evidence: {
        verdict,
        languageSlug: parsed.languageSlug,
        compileOutput: judgeResult.preTestFailure?.compileOutput ?? null,
        stderr: judgeResult.preTestFailure?.stderr ?? judgeResult.outcomes.find((o) => o.stderr)?.stderr ?? "",
        testCases: rows.map((row) => {
          const outcome = judgeResult.outcomes.find((o) => o.testCaseId === row.id);
          return {
            passed: outcome?.passed ?? false,
            isHidden: row.is_hidden,
            isEdgeCase: row.is_edge_case,
            errorType: outcome?.errorType ?? null,
            actualOutput: outcome?.actualOutput ?? null,
            expectedOutput: row.expected_output,
          };
        }),
      },
    });

    if (classification) {
      const timelineEvent = timelineMistakeEventType(classification.category);
      if (timelineEvent) {
        await recordLearningEvent(userSupabase, userId, {
          eventType: timelineEvent,
          problemId: problem.id,
          submissionId: submission.id,
          metadata: { verdict, category: classification.category, languageSlug: parsed.languageSlug },
        });
      }
    }

    const skillIds = await getSkillIdsTaughtByProblem(admin, problem.id);
    for (const skillId of skillIds) {
      await recalculateSkillMastery(admin, userId, skillId);
    }
  } catch (adaptiveLearningError) {
    console.error("[submit-code] adaptive learning update failed", adaptiveLearningError);
  }

  const visibleResults = rows
    .filter((row) => !row.is_hidden)
    .map((row) => {
      const outcome = judgeResult.outcomes.find((o) => o.testCaseId === row.id);
      return {
        testCaseId: row.id,
        passed: outcome?.passed ?? false,
        input: row.input,
        expectedOutput: row.expected_output,
        actualOutput: outcome?.actualOutput ?? "",
      };
    });

  const hiddenRows = rows.filter((row) => row.is_hidden);
  const hiddenPassed = hiddenRows.filter(
    (row) => judgeResult.outcomes.find((o) => o.testCaseId === row.id)?.passed,
  ).length;

  return {
    submissionId: submission.id,
    verdict,
    passedCount,
    totalCount,
    runtimeMs,
    memoryKb,
    compileOutput: judgeResult.preTestFailure?.compileOutput ?? null,
    visibleResults,
    hiddenSummary: { passed: hiddenPassed, total: hiddenRows.length },
    executionId,
  };
}

/**
 * Distinct hint levels the learner has revealed for this problem, via
 * requestHintEvent()'s learning_events rows (see lib/learning/actions.ts).
 * Deliberately counts *distinct levels ever revealed for this problem*,
 * not just this attempt — once a hint has been seen, later submissions
 * for the same problem are no longer independent evidence either. See
 * INDEPENDENCE SCORE.
 */
async function countHintsUsed(admin: SupabaseClient, userId: string, problemId: string): Promise<number> {
  const { data } = await admin
    .from("learning_events")
    .select("metadata")
    .eq("user_id", userId)
    .eq("problem_id", problemId)
    .eq("event_type", "hint_requested");

  const levels = new Set((data ?? []).map((row) => (row.metadata as { hintLevel?: number })?.hintLevel).filter((level) => level !== undefined));
  return levels.size;
}

