import type { ProjectScoringWeights, ProjectScoreBreakdown, ProjectVerdict } from "@/types/domain";
import type { Verdict } from "@/lib/judge/verdicts";

export interface ProjectTestOutcomeForScoring {
  passed: boolean;
  isHidden: boolean;
  isEdgeCase: boolean;
  verdict: Verdict;
}

export interface ProjectScoringResult {
  overallScore: number;
  breakdown: ProjectScoreBreakdown;
  verdict: ProjectVerdict;
}

const RESOURCE_LIMIT_VERDICTS: readonly Verdict[] = ["time_limit_exceeded", "memory_limit_exceeded", "output_limit_exceeded"];

/**
 * Deterministic, per-project-weighted scoring — see PROJECT EVALUATION:
 * "AI must never determine the core correctness score." Same input always
 * produces the same output; nothing here calls an AI provider. Every
 * sub-score is a real, documented proxy computed from judge output —
 * never a fabricated number:
 *
 *  - correctness: % of all test cases (visible + hidden) that passed.
 *    This is the only criterion that can make or break the pass verdict.
 *  - edgeCases: % of the cases specifically flagged is_edge_case that
 *    passed (100 when a stage defines none — never penalized for a
 *    criterion that doesn't apply).
 *  - testing: % of HIDDEN cases that passed — a proxy for "does this hold
 *    up under tests the learner couldn't see and design around," not a
 *    judgment of the learner's own test-writing (this project type
 *    doesn't ask them to write tests). Falls back to correctness when a
 *    stage has no hidden cases.
 *  - efficiency: 100 unless any outcome hit a resource-limit verdict
 *    (time/memory/output), in which case 40 — a coarse but honest signal;
 *    it does not attempt to infer algorithmic complexity from runtime
 *    alone.
 *  - codeQuality: a coarse proxy for "did the code run cleanly" — 100
 *    normally, 50 if a compile error blocked grading, 65 if any runtime
 *    error occurred. This is NOT static analysis; see PROJECT REVIEW's
 *    separate, clearly-labeled AI commentary for qualitative feedback
 *    that this proxy can't provide.
 *
 * verdict: 'passed' only when every test case passed. 'failed' when
 * nothing passed (including a compile/system error that blocked grading
 * entirely). Otherwise 'needs_improvement' — partial credit, not a
 * failure, and specifically never destructive to mastery (see PROJECT ->
 * MASTERY).
 */
export function computeProjectScore(
  outcomes: ProjectTestOutcomeForScoring[],
  weights: ProjectScoringWeights,
  preTestFailure: Verdict | null,
): ProjectScoringResult {
  const total = outcomes.length;
  const passed = outcomes.filter((o) => o.passed).length;

  const edgeCases = outcomes.filter((o) => o.isEdgeCase);
  const edgeCasesPassed = edgeCases.filter((o) => o.passed).length;

  const hidden = outcomes.filter((o) => o.isHidden);
  const hiddenPassed = hidden.filter((o) => o.passed).length;

  const correctness = total > 0 ? round(100 * (passed / total)) : 0;
  const edgeCasesScore = edgeCases.length > 0 ? round(100 * (edgeCasesPassed / edgeCases.length)) : 100;
  const testing = hidden.length > 0 ? round(100 * (hiddenPassed / hidden.length)) : correctness;

  const hitResourceLimit = outcomes.some((o) => RESOURCE_LIMIT_VERDICTS.includes(o.verdict));
  const efficiency = hitResourceLimit ? 40 : 100;

  const hadCompileError = preTestFailure === "compile_error";
  const hadRuntimeError = preTestFailure === "runtime_error" || outcomes.some((o) => o.verdict === "runtime_error");
  const codeQuality = hadCompileError ? 50 : hadRuntimeError ? 65 : 100;

  const breakdown: ProjectScoreBreakdown = { correctness, edgeCases: edgeCasesScore, efficiency, codeQuality, testing };

  const overallScore = round(
    (breakdown.correctness * weights.correctness +
      breakdown.edgeCases * weights.edgeCases +
      breakdown.efficiency * weights.efficiency +
      breakdown.codeQuality * weights.codeQuality +
      breakdown.testing * weights.testing) /
      100,
  );

  let verdict: ProjectVerdict;
  if (total > 0 && passed === total) {
    verdict = "passed";
  } else if (passed === 0) {
    verdict = "failed";
  } else {
    verdict = "needs_improvement";
  }

  return { overallScore, breakdown, verdict };
}

function round(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)));
}
