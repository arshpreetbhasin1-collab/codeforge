import { describe, expect, it } from "vitest";
import { classifyMistake } from "@/lib/mistakes/classifier";
import { summarizeMistakePatterns, topActivePatterns, MIN_PATTERN_OCCURRENCES } from "@/lib/mistakes/patterns";
import type { SubmissionMistakeEvidence, SubmissionTestCaseEvidence } from "@/lib/mistakes/types";

function tc(overrides: Partial<SubmissionTestCaseEvidence> = {}): SubmissionTestCaseEvidence {
  return {
    passed: true,
    isHidden: false,
    isEdgeCase: false,
    errorType: null,
    actualOutput: "42",
    expectedOutput: "42",
    ...overrides,
  };
}

function evidence(overrides: Partial<SubmissionMistakeEvidence> = {}): SubmissionMistakeEvidence {
  return {
    verdict: "wrong_answer",
    languageSlug: "python",
    compileOutput: null,
    stderr: "",
    testCases: [tc()],
    ...overrides,
  };
}

describe("classifyMistake — accepted / non-terminal", () => {
  it("returns null for an accepted submission — nothing to classify", () => {
    expect(classifyMistake(evidence({ verdict: "accepted" }))).toBeNull();
  });

  it("returns null for cancelled/queued/running — no completed evidence", () => {
    expect(classifyMistake(evidence({ verdict: "cancelled" }))).toBeNull();
    expect(classifyMistake(evidence({ verdict: "queued" }))).toBeNull();
    expect(classifyMistake(evidence({ verdict: "running" }))).toBeNull();
  });
});

describe("classifyMistake — compile errors", () => {
  it("recognizes a Python SyntaxError", () => {
    const result = classifyMistake(
      evidence({ verdict: "compile_error", compileOutput: "  File \"main.py\", line 3\nSyntaxError: invalid syntax" }),
    );
    expect(result?.category).toBe("syntax_error");
    expect(result?.confidence).toBe("high");
  });

  it("recognizes a Java type error", () => {
    const result = classifyMistake(
      evidence({ verdict: "compile_error", languageSlug: "java", compileOutput: "error: incompatible types: int cannot be converted to String" }),
    );
    expect(result?.category).toBe("type_error");
  });

  it("falls back to generic compilation_error with lower confidence when unmatched", () => {
    const result = classifyMistake(evidence({ verdict: "compile_error", compileOutput: "some unrecognized toolchain failure" }));
    expect(result?.category).toBe("compilation_error");
    expect(result?.confidence).toBe("medium");
  });

  it("classifies an unresolved SQL relation as a schema error", () => {
    const result = classifyMistake(
      evidence({ verdict: "compile_error", languageSlug: "sql", compileOutput: 'relation "orders" does not exist' }),
    );
    expect(result?.category).toBe("sql_schema_error");
  });
});

describe("classifyMistake — runtime errors", () => {
  it("recognizes an out-of-range index as a boundary error", () => {
    const result = classifyMistake(evidence({ verdict: "runtime_error", stderr: "IndexError: list index out of range" }));
    expect(result?.category).toBe("boundary_error");
  });

  it("recognizes division by zero as a logic error", () => {
    const result = classifyMistake(evidence({ verdict: "runtime_error", stderr: "ZeroDivisionError: division by zero" }));
    expect(result?.category).toBe("logic_error");
  });

  it("falls back to generic runtime_error at low confidence when unmatched", () => {
    const result = classifyMistake(evidence({ verdict: "runtime_error", stderr: "core dumped" }));
    expect(result?.category).toBe("runtime_error");
    expect(result?.confidence).toBe("low");
  });
});

describe("classifyMistake — resource limits", () => {
  it("time_limit_exceeded classifies as time_limit at high confidence", () => {
    expect(classifyMistake(evidence({ verdict: "time_limit_exceeded" }))?.category).toBe("time_limit");
  });

  it("output_limit_exceeded classifies as output_limit", () => {
    expect(classifyMistake(evidence({ verdict: "output_limit_exceeded" }))?.category).toBe("output_limit");
  });

  it("memory_limit_exceeded classifies as space_complexity, not fabricated as time-related", () => {
    expect(classifyMistake(evidence({ verdict: "memory_limit_exceeded" }))?.category).toBe("space_complexity");
  });

  it("system_error classifies as unknown at low confidence — not the learner's fault", () => {
    const result = classifyMistake(evidence({ verdict: "system_error" }));
    expect(result?.category).toBe("unknown");
    expect(result?.confidence).toBe("low");
  });
});

describe("classifyMistake — wrong answer", () => {
  it("classifies as edge_case_failure when only edge-case tests fail among otherwise-passing tests", () => {
    const result = classifyMistake(
      evidence({
        testCases: [tc({ passed: true }), tc({ passed: true }), tc({ passed: false, isEdgeCase: true })],
      }),
    );
    expect(result?.category).toBe("edge_case_failure");
    expect(result?.confidence).toBe("high");
  });

  it("classifies as output_format when actual matches expected loosely (whitespace/case only)", () => {
    const result = classifyMistake(
      evidence({ testCases: [tc({ passed: false, actualOutput: "Hello World\n", expectedOutput: "hello world" })] }),
    );
    expect(result?.category).toBe("output_format");
  });

  it("classifies as off_by_one when the numeric output differs by exactly one", () => {
    const result = classifyMistake(evidence({ testCases: [tc({ passed: false, actualOutput: "9", expectedOutput: "10" })] }));
    expect(result?.category).toBe("off_by_one");
  });

  it("classifies as logic_error when most of the test suite fails", () => {
    const result = classifyMistake(
      evidence({
        testCases: [
          tc({ passed: false, actualOutput: "1", expectedOutput: "99" }),
          tc({ passed: false, actualOutput: "2", expectedOutput: "88" }),
          tc({ passed: false, actualOutput: "3", expectedOutput: "77" }),
          tc({ passed: true }),
        ],
      }),
    );
    expect(result?.category).toBe("logic_error");
  });

  it("falls back to generic wrong_answer when only a minority of unrelated tests fail", () => {
    const result = classifyMistake(
      evidence({
        testCases: [tc({ passed: true }), tc({ passed: true }), tc({ passed: true }), tc({ passed: false, actualOutput: "17", expectedOutput: "42" })],
      }),
    );
    expect(result?.category).toBe("wrong_answer");
  });

  it("never fabricates a category when zero test cases actually failed", () => {
    const result = classifyMistake(evidence({ testCases: [tc({ passed: true })] }));
    expect(result?.category).toBe("unknown");
  });
});

describe("classifyMistake — determinism", () => {
  it("is deterministic for identical input", () => {
    const input = evidence({ verdict: "runtime_error", stderr: "IndexError: list index out of range" });
    expect(classifyMistake(input)).toEqual(classifyMistake(input));
  });
});

describe("summarizeMistakePatterns / topActivePatterns", () => {
  const NOW = new Date("2026-06-01T00:00:00Z");

  it("a single occurrence is not yet a pattern", () => {
    const summaries = summarizeMistakePatterns([{ category: "off_by_one", detectedAt: NOW }], NOW);
    expect(summaries[0].occurrenceCount).toBe(1);
    expect(summaries[0].isActive).toBe(false);
  });

  it("repeated recent occurrences of the same category form an active pattern", () => {
    const summaries = summarizeMistakePatterns(
      [
        { category: "off_by_one", detectedAt: new Date("2026-05-25") },
        { category: "off_by_one", detectedAt: NOW },
      ],
      NOW,
    );
    expect(summaries[0].occurrenceCount).toBe(2);
    expect(summaries[0].isActive).toBe(true);
    expect(summaries[0].occurrenceCount).toBeGreaterThanOrEqual(MIN_PATTERN_OCCURRENCES);
  });

  it("a pattern not seen in a long time is no longer considered active", () => {
    const summaries = summarizeMistakePatterns(
      [
        { category: "boundary_error", detectedAt: new Date("2025-01-01") },
        { category: "boundary_error", detectedAt: new Date("2025-01-15") },
      ],
      NOW,
    );
    expect(summaries[0].occurrenceCount).toBe(2);
    expect(summaries[0].isActive).toBe(false);
  });

  it("topActivePatterns filters out inactive and one-off categories, sorted by frequency", () => {
    const patterns = topActivePatterns(
      [
        { category: "off_by_one", detectedAt: NOW },
        { category: "off_by_one", detectedAt: new Date("2026-05-20") },
        { category: "off_by_one", detectedAt: new Date("2026-05-10") },
        { category: "logic_error", detectedAt: NOW },
        { category: "logic_error", detectedAt: new Date("2026-05-28") },
        { category: "syntax_error", detectedAt: NOW }, // only one occurrence — not a pattern
      ],
      5,
      NOW,
    );
    expect(patterns.map((p) => p.category)).toEqual(["off_by_one", "logic_error"]);
  });
});
