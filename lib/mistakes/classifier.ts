import type { SubmissionMistakeEvidence, SubmissionTestCaseEvidence, MistakeClassification } from "./types";

/**
 * Deterministic mistake classification — see MISTAKE DNA / ABSOLUTE RULES:
 * "classification must be evidence-based, never guessed." Every branch
 * below points at a concrete signal (verdict, stderr/compileOutput text,
 * or a specific comparison between actual and expected output) and the
 * `evidence` string on the result names that signal. When nothing
 * specific matches, this deliberately falls back to a low/medium
 * confidence generic category rather than inventing a specific one.
 *
 * Returns null when there is nothing to classify (an accepted submission,
 * or one that never reached a terminal state).
 */
export function classifyMistake(evidence: SubmissionMistakeEvidence): MistakeClassification | null {
  const isSql = evidence.languageSlug === "sql";
  const combinedOutput = `${evidence.compileOutput ?? ""}\n${evidence.stderr}`;

  switch (evidence.verdict) {
    case "accepted":
    case "queued":
    case "running":
    case "cancelled":
      return null;

    case "compile_error":
      return classifyCompileError(combinedOutput, isSql);

    case "runtime_error":
      return classifyRuntimeError(evidence.stderr);

    case "time_limit_exceeded":
      return {
        category: "time_limit",
        confidence: "high",
        evidence: "Execution exceeded the problem's time limit before producing a result.",
      };

    case "output_limit_exceeded":
      return {
        category: "output_limit",
        confidence: "high",
        evidence: "Program output exceeded the allowed size — often caused by an unbounded or infinite loop that keeps printing.",
      };

    case "memory_limit_exceeded":
      return {
        category: "space_complexity",
        confidence: "medium",
        evidence: "Execution exceeded the problem's memory limit, suggesting the solution uses more space than intended.",
      };

    case "system_error":
      return {
        category: "unknown",
        confidence: "low",
        evidence: "The execution provider could not determine an outcome — not attributable to the learner's code.",
      };

    case "wrong_answer":
      return classifyWrongAnswer(evidence.testCases);
  }
}

const SYNTAX_MARKERS = [
  "syntaxerror",
  "indentationerror",
  "unexpected token",
  "expected expression",
  "expected ';'",
  "';' expected",
  "expected declaration",
  "stray '",
  "unexpected end of input",
];

const TYPE_MARKERS = [
  "typeerror",
  "incompatible types",
  "cannot convert",
  "cannot find symbol",
  "no matching function",
  "no viable conversion",
  "does not name a type",
];

function classifyCompileError(output: string, isSql: boolean): MistakeClassification {
  const lower = output.toLowerCase();

  if (isSql) {
    if (/relation ".*" does not exist|column ".*" does not exist|no such table|no such column/.test(lower)) {
      return {
        category: "sql_schema_error",
        confidence: "high",
        evidence: "The query references a table or column that doesn't exist in the schema.",
      };
    }
    return {
      category: "sql_query_error",
      confidence: "medium",
      evidence: "The query failed before returning results — see the database error message.",
    };
  }

  const syntaxHit = SYNTAX_MARKERS.find((marker) => lower.includes(marker));
  if (syntaxHit) {
    return {
      category: "syntax_error",
      confidence: "high",
      evidence: `Compiler/interpreter output matched a syntax-error signature ("${syntaxHit}").`,
    };
  }

  const typeHit = TYPE_MARKERS.find((marker) => lower.includes(marker));
  if (typeHit) {
    return {
      category: "type_error",
      confidence: "high",
      evidence: `Compiler output matched a type-error signature ("${typeHit}").`,
    };
  }

  return {
    category: "compilation_error",
    confidence: "medium",
    evidence: "The code failed to compile, but the specific cause did not match a known syntax or type-error signature.",
  };
}

const BOUNDARY_MARKERS = [
  "index out of range",
  "list index out of range",
  "string index out of range",
  "indexerror",
  "arrayindexoutofboundsexception",
  "stringindexoutofboundsexception",
  "out_of_range",
  "vector::_m_range_check",
];

const DATA_STRUCTURE_MARKERS = ["nullpointerexception", "nonetype", "attributeerror", "keyerror", "nullreferenceexception"];

const LOGIC_MARKERS = ["zerodivisionerror", "division by zero", "divide by zero", "floating point exception"];

function classifyRuntimeError(stderr: string): MistakeClassification {
  const lower = stderr.toLowerCase();

  const boundaryHit = BOUNDARY_MARKERS.find((marker) => lower.includes(marker));
  if (boundaryHit) {
    return {
      category: "boundary_error",
      confidence: "medium",
      evidence: `Runtime error accessing a collection index ("${boundaryHit}") — often an off-by-one or unchecked boundary.`,
    };
  }

  const logicHit = LOGIC_MARKERS.find((marker) => lower.includes(marker));
  if (logicHit) {
    return {
      category: "logic_error",
      confidence: "medium",
      evidence: `Runtime error from an arithmetic condition the code didn't guard against ("${logicHit}").`,
    };
  }

  const dsHit = DATA_STRUCTURE_MARKERS.find((marker) => lower.includes(marker));
  if (dsHit) {
    return {
      category: "data_structure_misuse",
      confidence: "medium",
      evidence: `Runtime error consistent with using a value that was never populated ("${dsHit}").`,
    };
  }

  return {
    category: "runtime_error",
    confidence: "low",
    evidence: "The program crashed during execution; the specific cause did not match a known signature.",
  };
}

function classifyWrongAnswer(testCases: SubmissionTestCaseEvidence[]): MistakeClassification {
  const failing = testCases.filter((t) => !t.passed);
  const passingCount = testCases.length - failing.length;

  if (failing.length === 0) {
    return { category: "unknown", confidence: "low", evidence: "Submission was marked wrong_answer but every recorded test case passed." };
  }

  if (passingCount > 0 && failing.every((t) => t.isEdgeCase)) {
    return {
      category: "edge_case_failure",
      confidence: "high",
      evidence: `Passed ${passingCount} standard test case(s) but failed ${failing.length} case(s) specifically flagged as edge cases.`,
    };
  }

  const formatMismatch = failing.find(
    (t) => t.actualOutput != null && t.actualOutput !== t.expectedOutput && normalizeLoosely(t.actualOutput) === normalizeLoosely(t.expectedOutput),
  );
  if (formatMismatch) {
    return {
      category: "output_format",
      confidence: "high",
      evidence: "Output matches the expected result once whitespace/case differences are ignored — a formatting mismatch, not a logic error.",
    };
  }

  const offByOne = failing.find((t) => isOffByOneNumeric(t.actualOutput, t.expectedOutput));
  if (offByOne) {
    return {
      category: "off_by_one",
      confidence: "medium",
      evidence: `Output was numerically off by exactly one from the expected value (got "${offByOne.actualOutput}", expected "${offByOne.expectedOutput}").`,
    };
  }

  if (failing.length > testCases.length / 2) {
    return {
      category: "logic_error",
      confidence: "medium",
      evidence: `${failing.length} of ${testCases.length} test case(s) failed — most of the test suite, suggesting the core approach needs revisiting.`,
    };
  }

  return {
    category: "wrong_answer",
    confidence: "medium",
    evidence: `${failing.length} of ${testCases.length} test case(s) produced incorrect output.`,
  };
}

function normalizeLoosely(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isOffByOneNumeric(actual: string | null, expected: string): boolean {
  if (actual === null) return false;
  const a = actual.trim();
  const e = expected.trim();
  if (!/^-?\d+$/.test(a) || !/^-?\d+$/.test(e)) return false;
  return Math.abs(parseInt(a, 10) - parseInt(e, 10)) === 1;
}
