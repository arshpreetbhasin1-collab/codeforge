import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { codeRunSchema, type CodeRunInput } from "@/lib/validation/schemas";
import { getExecutableLanguage } from "@/lib/execution/registry";
import { generateExecutionId } from "@/lib/execution/execution-id";
import { checkRateLimit, RUN_RATE_LIMIT, SUBMIT_RATE_LIMIT } from "@/lib/security/rate-limit";
import { runJudge, type JudgeTestCase } from "./judge";
import { deriveVerdictFromOutcomes, type Verdict } from "@/lib/judge/verdicts";
import type { ComparisonMode } from "@/types/domain";

export interface RunCodeResult {
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
 * RUN: fast feedback against visible test cases only. Not an official
 * attempt — no submission record, no progress update. See SUBMIT VS RUN.
 */
export async function runCode(supabase: SupabaseClient, userId: string, input: CodeRunInput): Promise<RunCodeResult> {
  const parsed = codeRunSchema.parse(input);
  const executionId = generateExecutionId();

  const language = getExecutableLanguage(parsed.languageSlug);
  if (!language) {
    throw new Error(`Language "${parsed.languageSlug}" is not wired for execution.`);
  }

  await enforceRateLimit(supabase, userId, "code_runs");

  if (!parsed.problemId) {
    throw new Error("Run requires a problem.");
  }

  const { data: problem } = await supabase
    .from("problems")
    .select("id, time_limit_ms, memory_limit_mb, is_executable")
    .eq("id", parsed.problemId)
    .eq("is_published", true)
    .maybeSingle();

  if (!problem || !problem.is_executable) {
    throw new Error("This problem is not set up for execution.");
  }

  const { data: testCaseRows } = await supabase
    .from("problem_test_cases")
    .select("id, input, expected_output, comparison_mode, numeric_tolerance, time_limit_ms, memory_limit_mb")
    .eq("problem_id", problem.id)
    .eq("is_hidden", false)
    .order("sort_order", { ascending: true });

  const testCases: JudgeTestCase[] = ((testCaseRows as TestCaseRow[]) ?? []).map(toJudgeTestCase);

  let sqlDataset: { schemaSql: string; seedSql: string } | undefined;
  if (parsed.languageSlug === "sql") {
    const { data: dataset } = await supabase
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
  const verdict: Verdict = judgeResult.preTestFailure
    ? judgeResult.preTestFailure.verdict
    : deriveVerdictFromOutcomes(judgeResult.outcomes);

  await supabase.from("code_runs").insert({
    user_id: userId,
    problem_id: problem.id,
    language_id: await resolveLanguageId(supabase, parsed.languageSlug),
    source_code: parsed.sourceCode,
    stdin: parsed.stdin ?? null,
    status: verdict,
    stdout: tests[0]?.actualOutput ?? null,
    stderr: judgeResult.preTestFailure?.compileOutput ?? null,
    test_results: tests,
    execution_id: executionId,
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

export async function resolveLanguageId(supabase: SupabaseClient, slug: string): Promise<string> {
  const { data } = await supabase.from("languages").select("id").eq("slug", slug).single();
  if (!data) throw new Error(`Unknown language: ${slug}`);
  return data.id;
}

/**
 * Server-side abuse protection — see EXECUTION COST / ABUSE PROTECTION.
 * Counts this user's recent rows in `table` rather than keeping in-memory
 * state, so it survives server restarts and works across instances.
 */
export async function enforceRateLimit(
  supabase: SupabaseClient,
  userId: string,
  table: "code_runs" | "submissions",
): Promise<void> {
  const config = table === "code_runs" ? RUN_RATE_LIMIT : SUBMIT_RATE_LIMIT;
  const windowStart = new Date(Date.now() - config.windowMs).toISOString();

  const { data } = await supabase
    .from(table)
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", windowStart);

  const timestamps = (data ?? []).map((row) => new Date(row.created_at));
  const check = checkRateLimit(timestamps, new Date(), config);

  if (!check.allowed) {
    throw new Error(
      `Too many requests — please wait ${Math.ceil((check.retryAfterMs ?? 1000) / 1000)}s and try again.`,
    );
  }
}
