import type { ComparisonMode } from "@/types/domain";

/**
 * One comparison function per strategy. Problem authors choose the mode
 * explicitly (problem_test_cases.comparison_mode) — nothing here
 * normalizes output unless the author asked for that specific mode. See
 * JUDGE ENGINE: "Do NOT automatically normalize everything."
 */

export interface CompareOptions {
  numericTolerance?: number | null;
}

export function compareOutputs(
  mode: ComparisonMode,
  actual: string,
  expected: string,
  options: CompareOptions = {},
): boolean {
  switch (mode) {
    case "exact":
      return compareExact(actual, expected);
    case "trim":
      return compareTrim(actual, expected);
    case "normalize_whitespace":
      return compareNormalizedWhitespace(actual, expected);
    case "numeric_tolerance":
      return compareNumericTolerance(actual, expected, options.numericTolerance ?? 0);
    case "unordered_lines":
      return compareUnorderedLines(actual, expected);
    case "unordered_rows":
      return compareUnorderedRows(actual, expected);
    default: {
      const exhaustiveCheck: never = mode;
      throw new Error(`Unknown comparison mode: ${exhaustiveCheck}`);
    }
  }
}

export function compareExact(actual: string, expected: string): boolean {
  return actual === expected;
}

export function compareTrim(actual: string, expected: string): boolean {
  return actual.trim() === expected.trim();
}

export function compareNormalizedWhitespace(actual: string, expected: string): boolean {
  return normalizeWhitespace(actual) === normalizeWhitespace(expected);
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function compareNumericTolerance(actual: string, expected: string, tolerance: number): boolean {
  const a = Number.parseFloat(actual.trim());
  const e = Number.parseFloat(expected.trim());
  if (Number.isNaN(a) || Number.isNaN(e)) return false;
  return Math.abs(a - e) <= tolerance;
}

export function compareUnorderedLines(actual: string, expected: string): boolean {
  const normalize = (value: string) =>
    value
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .sort();
  const a = normalize(actual);
  const e = normalize(expected);
  return a.length === e.length && a.every((line, i) => line === e[i]);
}

/**
 * SQL result comparison. Both sides are the JSON-encoded `rows: unknown[][]`
 * form produced by the SQL sandbox (see services/execution/sql-sandbox.ts)
 * — compared as a multiset of rows, ignoring row order but not column
 * order within a row.
 */
export function compareUnorderedRows(actual: string, expected: string): boolean {
  let actualRows: unknown[][];
  let expectedRows: unknown[][];
  try {
    actualRows = JSON.parse(actual);
    expectedRows = JSON.parse(expected);
  } catch {
    return false;
  }
  if (!Array.isArray(actualRows) || !Array.isArray(expectedRows)) return false;
  if (actualRows.length !== expectedRows.length) return false;

  const canonicalize = (rows: unknown[][]) => rows.map((row) => JSON.stringify(row)).sort();
  const a = canonicalize(actualRows);
  const e = canonicalize(expectedRows);
  return a.every((row, i) => row === e[i]);
}
