import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { projectStageRunSchema, type ProjectStageRunInput } from "@/lib/validation/schemas";
import { getExecutableLanguage } from "@/lib/execution/registry";
import { generateExecutionId } from "@/lib/execution/execution-id";
import { runJudge, type JudgeTestCase } from "./judge";
import { deriveVerdictFromOutcomes, type Verdict } from "@/lib/judge/verdicts";
import { enforceRateLimit } from "./run-code";
import { recordLearningEvent } from "@/services/learning/record-learning-event";
import type { ComparisonMode } from "@/types/domain";

export interface RunProjectStageResult {
  verdict: Verdict;
  compileOutput: string | null;
  tests: {
    testCaseId: string;
    passed: boolean;
    input: string;
    expectedOutput: string;
    actualOutput: string;
    runtimeMs: number | null;
  }[];
  passedCount: number;
  totalCount: number;
  truncated: boolean;
  executionId: string;
}

interface TestCaseRow {
  id: string;
  input: string;
  expected_output: string;
  comparison_mode: ComparisonMode;
  numeric_tolerance: number | null;
  time_limit_ms: number | null;
  memory_limit_mb: number | null;
}

/**
 * RUN: fast feedback against a stage's visible test cases only — reuses
 * runJudge() exactly like services/execution/run-code.ts does for
 * problems (see PROJECT ENGINE: "Do NOT create another execution
 * system"). Not an official attempt: nothing is persisted to
 * project_submissions/project_test_results, matching problems' RUN vs
 * SUBMIT split. Unlike code_runs (which has a dedicated audit table),
 * a project run only logs a project_test_run learning event with the
 * pass/total counts — see LEARNING EVENTS: real signal, no new table
 * needed for something this small (mirrors how code_runs' own
 * test_results are stored inline rather than in a child table).
 */
export async function runProjectStage(supabase: SupabaseClient, userId: string, input: ProjectStageRunInput): Promise<RunProjectStageResult> {
  const parsed = projectStageRunSchema.parse(input);
  const executionId = generateExecutionId();

  const language = getExecutableLanguage(parsed.languageSlug);
  if (!language) {
    throw new Error(`Language "${parsed.languageSlug}" is not wired for execution.`);
  }

  await enforceRateLimit(supabase, userId, "code_runs");

  const { data: stage } = await supabase.from("project_stages").select("id, project_id").eq("id", parsed.stageId).eq("project_id", parsed.projectId).maybeSingle();
  if (!stage) {
    throw new Error("This project stage doesn't exist.");
  }

  const { data: languageLink } = await supabase.from("project_languages").select("id").eq("project_id", parsed.projectId).eq("language_id", await resolveLanguageId(supabase, parsed.languageSlug)).maybeSingle();
  if (!languageLink) {
    throw new Error(`This project doesn't support ${language.displayName}.`);
  }

  const { data: testCaseRows } = await supabase
    .from("project_test_cases")
    .select("id, input, expected_output, comparison_mode, numeric_tolerance, time_limit_ms, memory_limit_mb")
    .eq("stage_id", stage.id)
    .eq("is_hidden", false)
    .order("sort_order", { ascending: true });

  const testCases: JudgeTestCase[] = ((testCaseRows as TestCaseRow[]) ?? []).map(toJudgeTestCase);

  let sqlDataset: { schemaSql: string; seedSql: string } | undefined;
  if (parsed.languageSlug === "sql") {
    const { data: dataset } = await supabase.from("project_sql_datasets").select("schema_sql, seed_sql").eq("stage_id", stage.id).maybeSingle();
    if (!dataset) throw new Error("This SQL stage has no dataset configured.");
    sqlDataset = { schemaSql: dataset.schema_sql, seedSql: dataset.seed_sql };
  }

  const judgeResult = await runJudge({
    languageSlug: parsed.languageSlug,
    sourceCode: parsed.sourceCode,
    testCases,
    problemLimits: { timeLimitMs: 5000, memoryLimitMb: 256, outputLimitBytes: 64 * 1024 },
    sqlDataset,
  });

  const tests = judgeResult.outcomes.map((outcome) => {
    const testCase = testCases.find((tc) => tc.id === outcome.testCaseId)!;
    return {
      testCaseId: outcome.testCaseId,
      passed: outcome.passed,
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      actualOutput: outcome.actualOutput,
      runtimeMs: outcome.runtimeMs,
    };
  });

  const passedCount = tests.filter((t) => t.passed).length;
  const verdict: Verdict = judgeResult.preTestFailure ? judgeResult.preTestFailure.verdict : deriveVerdictFromOutcomes(judgeResult.outcomes);

  await recordLearningEvent(supabase, userId, {
    eventType: "project_test_run",
    projectId: parsed.projectId,
    metadata: { stageId: stage.id, passedCount, totalCount: testCases.length, verdict },
  });

  return {
    verdict,
    compileOutput: judgeResult.preTestFailure?.compileOutput ?? null,
    tests,
    passedCount,
    totalCount: testCases.length,
    truncated: judgeResult.truncated,
    executionId,
  };
}

function toJudgeTestCase(row: TestCaseRow): JudgeTestCase {
  return {
    id: row.id,
    input: row.input,
    expectedOutput: row.expected_output,
    comparisonMode: row.comparison_mode,
    numericTolerance: row.numeric_tolerance,
    timeLimitMs: row.time_limit_ms,
    memoryLimitMb: row.memory_limit_mb,
  };
}

async function resolveLanguageId(supabase: SupabaseClient, slug: string): Promise<string> {
  const { data } = await supabase.from("languages").select("id").eq("slug", slug).single();
  if (!data) throw new Error(`Unknown language: ${slug}`);
  return data.id;
}
