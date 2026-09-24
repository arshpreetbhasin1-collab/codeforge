import { describe, expect, it } from "vitest";
import {
  deriveOverallVerdict,
  deriveVerdictFromOutcomes,
  isPreTestFailure,
  verdictFromErrorCategory,
} from "@/lib/judge/verdicts";
import { scoreSubmission } from "@/lib/judge/scoring";

describe("verdictFromErrorCategory", () => {
  it("maps every execution error category to its verdict 1:1", () => {
    expect(verdictFromErrorCategory("compile_error")).toBe("compile_error");
    expect(verdictFromErrorCategory("time_limit_exceeded")).toBe("time_limit_exceeded");
  });
});

describe("isPreTestFailure", () => {
  it("treats compile/system/timeout/memory/output failures as pre-test", () => {
    expect(isPreTestFailure("compile_error")).toBe(true);
    expect(isPreTestFailure("system_error")).toBe(true);
    expect(isPreTestFailure("time_limit_exceeded")).toBe(true);
  });

  it("does not treat accepted/wrong_answer as pre-test failures", () => {
    expect(isPreTestFailure("accepted")).toBe(false);
    expect(isPreTestFailure("wrong_answer")).toBe(false);
  });
});

describe("deriveOverallVerdict", () => {
  it("a compile error always wins, regardless of test counts", () => {
    const verdict = deriveOverallVerdict({ preTestFailure: "compile_error", totalTests: 5, passedTests: 5 });
    expect(verdict).toBe("compile_error");
  });

  it("all tests passing is accepted", () => {
    const verdict = deriveOverallVerdict({ preTestFailure: null, totalTests: 5, passedTests: 5 });
    expect(verdict).toBe("accepted");
  });

  it("any test failing is wrong_answer, not a partial accept", () => {
    const verdict = deriveOverallVerdict({ preTestFailure: null, totalTests: 5, passedTests: 4 });
    expect(verdict).toBe("wrong_answer");
  });

  it("zero test cases is a system error, never a silent accept", () => {
    const verdict = deriveOverallVerdict({ preTestFailure: null, totalTests: 0, passedTests: 0 });
    expect(verdict).toBe("system_error");
  });
});

describe("deriveVerdictFromOutcomes", () => {
  // Regression test: this exact bug shipped once — the overall verdict was
  // computed purely from passed/total counts, so a submission where every
  // test case actually crashed with a runtime error still reported
  // "wrong_answer" instead of "runtime_error". Caught by real end-to-end
  // execution against a live provider, not by a unit test in isolation —
  // see the Prompt 3 report.
  it("reports runtime_error as the overall verdict when any outcome is a runtime error, not a generic wrong_answer", () => {
    const verdict = deriveVerdictFromOutcomes([
      { verdict: "accepted" },
      { verdict: "runtime_error" },
    ]);
    expect(verdict).toBe("runtime_error");
  });

  it("reports time_limit_exceeded even if it's the only outcome recorded (judge halted early)", () => {
    expect(deriveVerdictFromOutcomes([{ verdict: "time_limit_exceeded" }])).toBe("time_limit_exceeded");
  });

  it("prioritizes timeout over a plain runtime error when both occur", () => {
    const verdict = deriveVerdictFromOutcomes([
      { verdict: "runtime_error" },
      { verdict: "time_limit_exceeded" },
    ]);
    expect(verdict).toBe("time_limit_exceeded");
  });

  it("is accepted only when every outcome is accepted", () => {
    expect(deriveVerdictFromOutcomes([{ verdict: "accepted" }, { verdict: "accepted" }])).toBe("accepted");
  });

  it("is wrong_answer when outcomes are a mix of accepted and plain failures with no specific error", () => {
    expect(deriveVerdictFromOutcomes([{ verdict: "accepted" }, { verdict: "wrong_answer" }])).toBe("wrong_answer");
  });

  it("treats zero outcomes as a system error rather than a silent accept", () => {
    expect(deriveVerdictFromOutcomes([])).toBe("system_error");
  });
});

describe("scoreSubmission", () => {
  it("weights the score by test case weight, not raw count", () => {
    const summary = scoreSubmission([
      { passed: true, weight: 1 },
      { passed: false, weight: 3 },
    ]);
    expect(summary.passedCount).toBe(1);
    expect(summary.totalCount).toBe(2);
    expect(summary.scorePercent).toBe(25); // 1 / (1+3)
  });

  it("returns zero for an empty result set rather than dividing by zero", () => {
    expect(scoreSubmission([])).toEqual({ passedCount: 0, totalCount: 0, scorePercent: 0 });
  });
});
