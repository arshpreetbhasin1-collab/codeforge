import "server-only";
import { getExecutableLanguage, type ExecutableLanguageSlug } from "@/lib/execution/registry";
import { resolveExecutionProvider } from "@/lib/execution/provider";
import { executeSql } from "./sql-sandbox";
import { compareOutputs } from "@/lib/judge/compare";
import { verdictFromErrorCategory, type Verdict } from "@/lib/judge/verdicts";
import type { ExecutionResult, ResourceLimits } from "@/lib/execution/types";
import type { ComparisonMode } from "@/types/domain";

export interface JudgeTestCase {
  id: string;
  input: string;
  expectedOutput: string;
  comparisonMode: ComparisonMode;
  numericTolerance: number | null;
  timeLimitMs: number | null;
  memoryLimitMb: number | null;
}

export interface JudgeTestOutcome {
  testCaseId: string;
  passed: boolean;
  actualOutput: string;
  runtimeMs: number | null;
  memoryUsedKb: number | null;
  verdict: Verdict;
  errorType: string | null;
  /** Raw stderr from the provider — used by lib/mistakes/classifier.ts to distinguish e.g. an index error from a null-pointer error. Never shown to the client. */
  stderr: string;
}

export interface JudgeRunResult {
  outcomes: JudgeTestOutcome[];
  /** Set when execution failed before any comparison could happen (compile error, timeout, system error). */
  preTestFailure: { verdict: Verdict; compileOutput: string | null; stderr: string } | null;
  truncated: boolean;
}

export interface JudgeInput {
  languageSlug: ExecutableLanguageSlug;
  sourceCode: string;
  testCases: JudgeTestCase[];
  problemLimits: ResourceLimits;
  /** Required when languageSlug === "sql". */
  sqlDataset?: { schemaSql: string; seedSql: string };
}

/**
 * Runs `sourceCode` against every test case and judges each one. Shared by
 * both RUN (visible tests) and SUBMIT (visible + hidden) — see SUBMIT VS
 * RUN. Callers decide what to persist and what to reveal to the client;
 * this function only ever returns to server-side code.
 *
 * SQL is executed once (the query doesn't vary per test case — see the
 * Prompt 3 report's SQL isolation section) and the single result is
 * compared against every test case's expected_output. Every other
 * language re-executes per test case, since stdin varies.
 */
export async function runJudge(input: JudgeInput): Promise<JudgeRunResult> {
  if (input.languageSlug === "sql") {
    return judgeSql(input);
  }
  return judgeStdinStdout(input);
}

async function judgeStdinStdout(input: JudgeInput): Promise<JudgeRunResult> {
  const language = getExecutableLanguage(input.languageSlug);
  if (!language || !language.providerLanguageId) {
    throw new Error(`Language not wired for execution: ${input.languageSlug}`);
  }
  const provider = resolveExecutionProvider();

  const outcomes: JudgeTestOutcome[] = [];
  let truncated = false;

  for (const testCase of input.testCases) {
    const limits: ResourceLimits = {
      timeLimitMs: testCase.timeLimitMs ?? input.problemLimits.timeLimitMs,
      memoryLimitMb: testCase.memoryLimitMb ?? input.problemLimits.memoryLimitMb,
      outputLimitBytes: input.problemLimits.outputLimitBytes,
    };

    const result = await provider.execute({
      providerLanguageId: language.providerLanguageId,
      sourceCode: input.sourceCode,
      stdin: testCase.input,
      limits,
    });

    truncated = truncated || result.truncated;

    if (result.errorCategory === "compile_error") {
      return {
        outcomes,
        preTestFailure: {
          verdict: "compile_error",
          compileOutput: result.compileOutput,
          stderr: "",
        },
        truncated,
      };
    }

    if (result.errorCategory === "system_error") {
      return {
        outcomes,
        preTestFailure: { verdict: "system_error", compileOutput: null, stderr: "" },
        truncated,
      };
    }

    const outcome = judgeSingleOutcome(testCase, result);
    outcomes.push(outcome);

    // Stop immediately on a resource-risk verdict — see INFINITE LOOPS /
    // OUTPUT LIMIT: re-running the same runaway code against every
    // remaining test case would repeatedly hammer the execution provider
    // for no diagnostic benefit (the same infinite loop will time out
    // again on the next input too). Wrong answers and plain runtime
    // errors are cheap and diagnostically useful, so those keep going —
    // see WRONG ANSWER EXPERIENCE, which wants to show "7/10 passed".
    if (
      outcome.verdict === "time_limit_exceeded" ||
      outcome.verdict === "memory_limit_exceeded" ||
      outcome.verdict === "output_limit_exceeded"
    ) {
      break;
    }
  }

  return { outcomes, preTestFailure: null, truncated };
}

async function judgeSql(input: JudgeInput): Promise<JudgeRunResult> {
  if (!input.sqlDataset) {
    throw new Error("SQL judge requires a dataset.");
  }
  if (input.testCases.length === 0) {
    return { outcomes: [], preTestFailure: null, truncated: false };
  }

  const result = await executeSql(input.sourceCode, input.sqlDataset, input.problemLimits);

  if (result.errorCategory === "compile_error") {
    // The SQL validator rejects the statement before execution — reported
    // as a "compile error" (invalid query) rather than a runtime failure.
    return {
      outcomes: [],
      preTestFailure: { verdict: "compile_error", compileOutput: result.compileOutput, stderr: "" },
      truncated: false,
    };
  }

  if (result.errorCategory === "time_limit_exceeded" || result.errorCategory === "system_error") {
    return {
      outcomes: [],
      preTestFailure: {
        verdict: result.errorCategory === "time_limit_exceeded" ? "time_limit_exceeded" : "system_error",
        compileOutput: null,
        stderr: "",
      },
      truncated: false,
    };
  }

  if (result.errorCategory === "runtime_error") {
    return {
      outcomes: input.testCases.map((tc) => ({
        testCaseId: tc.id,
        passed: false,
        actualOutput: "",
        runtimeMs: result.executionTimeMs,
        memoryUsedKb: null,
        verdict: "runtime_error",
        errorType: "runtime_error",
        stderr: result.stderr,
      })),
      preTestFailure: null,
      truncated: false,
    };
  }

  // One successful execution, graded against every test case's expectation.
  const outcomes = input.testCases.map((testCase) => judgeSingleOutcome(testCase, result));
  return { outcomes, preTestFailure: null, truncated: result.truncated };
}

function judgeSingleOutcome(testCase: JudgeTestCase, result: ExecutionResult): JudgeTestOutcome {
  if (result.errorCategory && result.errorCategory !== "compile_error" && result.errorCategory !== "system_error") {
    return {
      testCaseId: testCase.id,
      passed: false,
      actualOutput: result.stdout,
      runtimeMs: result.executionTimeMs,
      memoryUsedKb: result.memoryUsedKb,
      verdict: verdictFromErrorCategory(result.errorCategory),
      errorType: result.errorCategory,
      stderr: result.stderr,
    };
  }

  const passed = compareOutputs(testCase.comparisonMode, result.stdout, testCase.expectedOutput, {
    numericTolerance: testCase.numericTolerance,
  });

  return {
    testCaseId: testCase.id,
    passed,
    actualOutput: result.stdout,
    runtimeMs: result.executionTimeMs,
    memoryUsedKb: result.memoryUsedKb,
    verdict: passed ? "accepted" : "wrong_answer",
    errorType: null,
    stderr: result.stderr,
  };
}
