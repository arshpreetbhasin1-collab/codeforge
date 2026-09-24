import type { ExecutionErrorCategory } from "@/lib/execution/types";

/**
 * The full verdict vocabulary the UI understands — see EXECUTION STATES.
 * QUEUED/RUNNING exist for architectural completeness (a future async
 * provider) but this phase's synchronous Wandbox/SQL-sandbox providers
 * only ever produce a terminal verdict — no fabricated COMPILING/JUDGING
 * sub-states are shown, see SUBMISSION UX: "Do not fake progress."
 */
export type Verdict =
  | "queued"
  | "running"
  | "accepted"
  | "wrong_answer"
  | "compile_error"
  | "runtime_error"
  | "time_limit_exceeded"
  | "memory_limit_exceeded"
  | "output_limit_exceeded"
  | "system_error"
  | "cancelled";

export const VERDICT_LABEL: Record<Verdict, string> = {
  queued: "Queued",
  running: "Running",
  accepted: "Accepted",
  wrong_answer: "Wrong Answer",
  compile_error: "Compile Error",
  runtime_error: "Runtime Error",
  time_limit_exceeded: "Time Limit Exceeded",
  memory_limit_exceeded: "Memory Limit Exceeded",
  output_limit_exceeded: "Output Limit Exceeded",
  system_error: "System Error",
  cancelled: "Cancelled",
};

/** A verdict that stopped the run before any test comparison happened. */
export function isPreTestFailure(verdict: Verdict): boolean {
  return (
    verdict === "compile_error" ||
    verdict === "system_error" ||
    verdict === "cancelled" ||
    verdict === "time_limit_exceeded" ||
    verdict === "memory_limit_exceeded" ||
    verdict === "output_limit_exceeded"
  );
}

/**
 * Maps an execution provider's error category to the verdict for that
 * single test case — before test-output comparison has even happened.
 */
export function verdictFromErrorCategory(category: ExecutionErrorCategory): Verdict {
  return category;
}

/**
 * Derives the overall submission verdict from per-test-case pass/fail plus
 * any pre-test failure that stopped execution entirely. Compile/system
 * errors always win — they mean no test actually ran.
 */
export function deriveOverallVerdict(input: {
  preTestFailure: Verdict | null;
  totalTests: number;
  passedTests: number;
}): Verdict {
  if (input.preTestFailure) return input.preTestFailure;
  if (input.totalTests === 0) return "system_error";
  return input.passedTests === input.totalTests ? "accepted" : "wrong_answer";
}

/**
 * Verdict priority when individual test-case outcomes carry their own
 * verdict (runtime error, timeout, ...) rather than a plain pass/fail —
 * see EXECUTION STATES. A single runtime error anywhere means the overall
 * submission is a runtime error, not a generic "some tests failed" —
 * reporting the specific failure is what lets WRONG ANSWER EXPERIENCE vs
 * RUNTIME ERROR show the right guidance.
 */
const OUTCOME_VERDICT_PRIORITY: Verdict[] = [
  "time_limit_exceeded",
  "memory_limit_exceeded",
  "output_limit_exceeded",
  "runtime_error",
];

export function deriveVerdictFromOutcomes(outcomes: { verdict: Verdict }[]): Verdict {
  if (outcomes.length === 0) return "system_error";
  for (const priority of OUTCOME_VERDICT_PRIORITY) {
    if (outcomes.some((o) => o.verdict === priority)) return priority;
  }
  return outcomes.every((o) => o.verdict === "accepted") ? "accepted" : "wrong_answer";
}
