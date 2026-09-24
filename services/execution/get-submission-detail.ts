import "server-only";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import type { SubmissionStatus } from "@/types/domain";

export interface SubmissionDetail {
  id: string;
  languageName: string;
  languageSlug: string;
  status: SubmissionStatus;
  sourceCode: string;
  passedTestCount: number;
  totalTestCount: number;
  runtimeMs: number | null;
  memoryKb: number | null;
  executionId: string | null;
  createdAt: string;
  visibleResults: {
    testCaseId: string;
    passed: boolean;
    input: string;
    expectedOutput: string;
    actualOutput: string | null;
    errorType: string | null;
  }[];
  hiddenSummary: { passed: number; total: number };
}

/**
 * Uses the admin client (bypasses RLS) so it can read problem_test_cases'
 * `is_hidden` flag to decide what to include — then explicitly strips
 * hidden test bodies before returning, rather than relying on RLS to do
 * it implicitly through a join. Ownership is checked explicitly here
 * since the admin client doesn't enforce it. See HIDDEN TESTS.
 */
export async function getSubmissionDetail(userId: string, submissionId: string): Promise<SubmissionDetail | null> {
  const admin = createSupabaseAdminClient();

  const { data: submission } = await admin
    .from("submissions")
    .select(
      "id, user_id, source_code, status, passed_test_count, total_test_count, runtime_ms, memory_kb, execution_id, created_at, languages(slug, display_name)",
    )
    .eq("id", submissionId)
    .maybeSingle();

  type SubmissionRow = {
    id: string;
    user_id: string;
    source_code: string;
    status: SubmissionStatus;
    passed_test_count: number;
    total_test_count: number;
    runtime_ms: number | null;
    memory_kb: number | null;
    execution_id: string | null;
    created_at: string;
    languages: { slug: string; display_name: string } | null;
  };

  const row = submission as unknown as SubmissionRow | null;
  if (!row || row.user_id !== userId) return null;

  const { data: resultRows } = await admin
    .from("submission_results")
    .select("test_case_id, passed, actual_output, error_type, problem_test_cases(input, expected_output, is_hidden)")
    .eq("submission_id", submissionId);

  type ResultRow = {
    test_case_id: string;
    passed: boolean;
    actual_output: string | null;
    error_type: string | null;
    problem_test_cases: { input: string; expected_output: string; is_hidden: boolean } | null;
  };

  const results = (resultRows as unknown as ResultRow[]) ?? [];
  const visible = results.filter((r) => r.problem_test_cases && !r.problem_test_cases.is_hidden);
  const hidden = results.filter((r) => r.problem_test_cases?.is_hidden);

  return {
    id: row.id,
    languageName: row.languages?.display_name ?? "Unknown",
    languageSlug: row.languages?.slug ?? "unknown",
    status: row.status,
    sourceCode: row.source_code,
    passedTestCount: row.passed_test_count,
    totalTestCount: row.total_test_count,
    runtimeMs: row.runtime_ms,
    memoryKb: row.memory_kb,
    executionId: row.execution_id,
    createdAt: row.created_at,
    visibleResults: visible.map((r) => ({
      testCaseId: r.test_case_id,
      passed: r.passed,
      input: r.problem_test_cases!.input,
      expectedOutput: r.problem_test_cases!.expected_output,
      actualOutput: r.actual_output,
      errorType: r.error_type,
    })),
    hiddenSummary: { passed: hidden.filter((r) => r.passed).length, total: hidden.length },
  };
}
