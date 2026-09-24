import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SubmissionMistakeEvidence } from "@/lib/mistakes/types";
import type { Verdict } from "@/lib/judge/verdicts";

export interface ReconstructedSubmission {
  userId: string;
  problemId: string;
  evidence: SubmissionMistakeEvidence;
}

/**
 * Reconstructs classifier input from already-persisted rows — what
 * scripts/backfill-mastery.ts uses to classify submissions that predate
 * a formula change, without re-running any code. Depends on
 * submissions.compile_output and submission_results.stderr
 * (db/schema/017_mistake_evidence_columns.sql) actually having been
 * populated at submit time; older rows from before that migration will
 * classify compile/runtime errors with less specificity (no raw text to
 * pattern-match), which is the honest outcome — see NO FAKE METRICS.
 */
export async function buildEvidenceFromSubmission(supabase: SupabaseClient, submissionId: string): Promise<ReconstructedSubmission | null> {
  const { data: submission, error: submissionError } = await supabase
    .from("submissions")
    .select("id, user_id, problem_id, language_id, status, compile_output")
    .eq("id", submissionId)
    .maybeSingle();

  if (submissionError) throw new Error(`Failed to load submission: ${submissionError.message}`);
  if (!submission) return null;

  const { data: language } = await supabase.from("languages").select("slug").eq("id", submission.language_id).maybeSingle();

  const { data: resultRows, error: resultsError } = await supabase
    .from("submission_results")
    .select("passed, actual_output, error_type, stderr, test_case_id")
    .eq("submission_id", submissionId);

  if (resultsError) throw new Error(`Failed to load submission results: ${resultsError.message}`);

  const testCaseIds = (resultRows ?? []).map((r) => r.test_case_id as string);
  const { data: testCaseRows } = testCaseIds.length
    ? await supabase.from("problem_test_cases").select("id, expected_output, is_hidden, is_edge_case").in("id", testCaseIds)
    : { data: [] as { id: string; expected_output: string; is_hidden: boolean; is_edge_case: boolean }[] };

  const testCaseById = new Map((testCaseRows ?? []).map((tc) => [tc.id as string, tc]));
  const combinedStderr = (resultRows ?? []).find((r) => r.stderr)?.stderr ?? "";

  const evidence: SubmissionMistakeEvidence = {
    verdict: submission.status as Verdict,
    languageSlug: (language?.slug as string) ?? "unknown",
    compileOutput: submission.compile_output as string | null,
    stderr: combinedStderr as string,
    testCases: (resultRows ?? []).map((row) => {
      const testCase = testCaseById.get(row.test_case_id as string);
      return {
        passed: row.passed as boolean,
        isHidden: testCase?.is_hidden ?? false,
        isEdgeCase: testCase?.is_edge_case ?? false,
        errorType: row.error_type as string | null,
        actualOutput: row.actual_output as string | null,
        expectedOutput: testCase?.expected_output ?? "",
      };
    }),
  };

  return { userId: submission.user_id as string, problemId: submission.problem_id as string, evidence };
}
