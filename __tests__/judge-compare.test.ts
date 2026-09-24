import { describe, expect, it } from "vitest";
import {
  compareExact,
  compareNormalizedWhitespace,
  compareNumericTolerance,
  compareOutputs,
  compareTrim,
  compareUnorderedLines,
  compareUnorderedRows,
} from "@/lib/judge/compare";

describe("compareExact", () => {
  it("requires byte-for-byte equality, including trailing newline", () => {
    expect(compareExact("15\n", "15\n")).toBe(true);
    expect(compareExact("15", "15\n")).toBe(false);
  });
});

describe("compareTrim", () => {
  it("ignores leading/trailing whitespace but not internal differences", () => {
    expect(compareTrim("  15\n", "15")).toBe(true);
    expect(compareTrim("1 5", "15")).toBe(false);
  });
});

describe("compareNormalizedWhitespace", () => {
  it("collapses internal whitespace runs", () => {
    expect(compareNormalizedWhitespace("1   2\t3", "1 2 3")).toBe(true);
  });

  it("still distinguishes genuinely different tokens", () => {
    expect(compareNormalizedWhitespace("1 2 3", "1 2 4")).toBe(false);
  });
});

describe("compareNumericTolerance", () => {
  it("accepts a difference within tolerance", () => {
    expect(compareNumericTolerance("3.14159", "3.14", 0.01)).toBe(true);
  });

  it("rejects a difference outside tolerance", () => {
    expect(compareNumericTolerance("3.2", "3.0", 0.01)).toBe(false);
  });

  it("never crashes on non-numeric input — fails safely instead", () => {
    expect(compareNumericTolerance("not a number", "3.0", 0.01)).toBe(false);
  });
});

describe("compareUnorderedLines", () => {
  it("matches regardless of line order", () => {
    expect(compareUnorderedLines("b\na\nc", "a\nb\nc")).toBe(true);
  });

  it("still requires the same multiset of lines", () => {
    expect(compareUnorderedLines("a\nb", "a\nb\nb")).toBe(false);
  });
});

describe("compareUnorderedRows (SQL)", () => {
  it("matches rows regardless of row order", () => {
    const actual = JSON.stringify([
      ["Alice", 95000],
      ["Bob", 72000],
    ]);
    const expected = JSON.stringify([
      ["Bob", 72000],
      ["Alice", 95000],
    ]);
    expect(compareUnorderedRows(actual, expected)).toBe(true);
  });

  it("rejects a different row count", () => {
    const actual = JSON.stringify([["Alice", 95000]]);
    const expected = JSON.stringify([
      ["Alice", 95000],
      ["Bob", 72000],
    ]);
    expect(compareUnorderedRows(actual, expected)).toBe(false);
  });

  it("fails safely on invalid JSON rather than throwing", () => {
    expect(compareUnorderedRows("not json", "[]")).toBe(false);
  });
});

describe("compareOutputs dispatch", () => {
  it("routes to the correct comparator by mode", () => {
    expect(compareOutputs("trim", " 15 ", "15")).toBe(true);
    expect(compareOutputs("exact", " 15 ", "15")).toBe(false);
    expect(compareOutputs("numeric_tolerance", "3.001", "3.0", { numericTolerance: 0.01 })).toBe(true);
  });
});
