import { describe, it, expect } from "vitest";
import { computeProjectScore, type ProjectTestOutcomeForScoring } from "@/lib/projects/scoring";
import type { ProjectScoringWeights } from "@/types/domain";

const WEIGHTS: ProjectScoringWeights = { correctness: 50, edgeCases: 15, efficiency: 15, codeQuality: 10, testing: 10 };

const outcome = (overrides: Partial<ProjectTestOutcomeForScoring> = {}): ProjectTestOutcomeForScoring => ({
  passed: true,
  isHidden: false,
  isEdgeCase: false,
  verdict: "accepted",
  ...overrides,
});

describe("computeProjectScore", () => {
  it("scores a perfect submission 100 with a 'passed' verdict", () => {
    const outcomes = [outcome(), outcome({ isHidden: true }), outcome({ isEdgeCase: true })];
    const result = computeProjectScore(outcomes, WEIGHTS, null);
    expect(result.verdict).toBe("passed");
    expect(result.overallScore).toBe(100);
    expect(result.breakdown).toEqual({ correctness: 100, edgeCases: 100, efficiency: 100, codeQuality: 100, testing: 100 });
  });

  it("scores a fully failing submission 'failed' with correctness 0", () => {
    const outcomes = [outcome({ passed: false, verdict: "wrong_answer" }), outcome({ passed: false, verdict: "wrong_answer" })];
    const result = computeProjectScore(outcomes, WEIGHTS, null);
    expect(result.verdict).toBe("failed");
    expect(result.breakdown.correctness).toBe(0);
  });

  it("treats a submission that blocked all grading (compile error, zero outcomes) as 'failed'", () => {
    const result = computeProjectScore([], WEIGHTS, "compile_error");
    expect(result.verdict).toBe("failed");
    expect(result.breakdown.correctness).toBe(0);
    expect(result.breakdown.codeQuality).toBe(50);
  });

  it("scores a partial pass as 'needs_improvement', never 'passed' or 'failed'", () => {
    const outcomes = [outcome(), outcome({ passed: false, verdict: "wrong_answer" })];
    const result = computeProjectScore(outcomes, WEIGHTS, null);
    expect(result.verdict).toBe("needs_improvement");
    expect(result.breakdown.correctness).toBe(50);
  });

  it("never penalizes edgeCases or testing when a stage defines no edge/hidden cases", () => {
    const outcomes = [outcome(), outcome()];
    const result = computeProjectScore(outcomes, WEIGHTS, null);
    expect(result.breakdown.edgeCases).toBe(100);
    expect(result.breakdown.testing).toBe(100); // falls back to correctness, which is 100 here
  });

  it("scores edge cases and hidden ('testing') coverage independently of overall correctness", () => {
    const outcomes = [
      outcome(), // visible, passed
      outcome({ isEdgeCase: true, passed: false, verdict: "wrong_answer" }), // edge case, failed
      outcome({ isHidden: true }), // hidden, passed
      outcome({ isHidden: true, passed: false, verdict: "wrong_answer" }), // hidden, failed
    ];
    const result = computeProjectScore(outcomes, WEIGHTS, null);
    expect(result.breakdown.correctness).toBe(50); // 2 of 4 passed
    expect(result.breakdown.edgeCases).toBe(0); // 0 of 1 edge case passed
    expect(result.breakdown.testing).toBe(50); // 1 of 2 hidden passed
    expect(result.verdict).toBe("needs_improvement");
  });

  it("penalizes efficiency deterministically when any outcome hits a resource limit", () => {
    const outcomes = [outcome(), outcome({ passed: false, verdict: "time_limit_exceeded" })];
    const result = computeProjectScore(outcomes, WEIGHTS, null);
    expect(result.breakdown.efficiency).toBe(40);
  });

  it("penalizes codeQuality on a runtime error even without a full failure", () => {
    const outcomes = [outcome(), outcome({ passed: false, verdict: "runtime_error" })];
    const result = computeProjectScore(outcomes, WEIGHTS, null);
    expect(result.breakdown.codeQuality).toBe(65);
  });

  it("applies the configured weights, not a hardcoded default, to the overall score", () => {
    const outcomes = [outcome({ passed: false, verdict: "wrong_answer" })]; // correctness 0, everything else 100 (no edge/hidden cases)
    const allCorrectnessWeights: ProjectScoringWeights = { correctness: 100, edgeCases: 0, efficiency: 0, codeQuality: 0, testing: 0 };
    const result = computeProjectScore(outcomes, allCorrectnessWeights, null);
    expect(result.overallScore).toBe(0);

    const noCorrectnessWeights: ProjectScoringWeights = { correctness: 0, edgeCases: 0, efficiency: 100, codeQuality: 0, testing: 0 };
    const result2 = computeProjectScore(outcomes, noCorrectnessWeights, null);
    expect(result2.overallScore).toBe(100); // efficiency is 100 (no resource-limit outcome), fully weighted
  });

  it("is deterministic — identical input always produces identical output", () => {
    const outcomes = [outcome(), outcome({ passed: false, verdict: "wrong_answer", isEdgeCase: true })];
    const a = computeProjectScore(outcomes, WEIGHTS, null);
    const b = computeProjectScore(outcomes, WEIGHTS, null);
    expect(a).toEqual(b);
  });

  it("clamps the overall score to 0-100 even with malformed weights", () => {
    const outcomes = [outcome()];
    const overweighted: ProjectScoringWeights = { correctness: 500, edgeCases: 0, efficiency: 0, codeQuality: 0, testing: 0 };
    const result = computeProjectScore(outcomes, overweighted, null);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });
});
