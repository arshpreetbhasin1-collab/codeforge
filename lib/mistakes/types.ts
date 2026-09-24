import type { MistakeCategory, MistakeConfidence } from "@/types/domain";
import type { Verdict } from "@/lib/judge/verdicts";

/** One test case outcome as recorded in submission_results — the raw material for classification. */
export interface SubmissionTestCaseEvidence {
  passed: boolean;
  isHidden: boolean;
  isEdgeCase: boolean;
  /** submission_results.error_type — a single test case's own ExecutionErrorCategory, if it failed before comparison. */
  errorType: string | null;
  actualOutput: string | null;
  expectedOutput: string;
}

/**
 * Everything classifyMistake needs about one submission. Pure data in —
 * see lib/mastery's convention of never touching Supabase here; the
 * mapping from real rows lives in services/mistakes/classify-submission.ts.
 */
export interface SubmissionMistakeEvidence {
  verdict: Verdict;
  languageSlug: string;
  compileOutput: string | null;
  stderr: string;
  testCases: SubmissionTestCaseEvidence[];
}

export interface MistakeClassification {
  category: MistakeCategory;
  confidence: MistakeConfidence;
  /** Human-readable, auditable — see EXPLAINABILITY: never classify silently. */
  evidence: string;
}
