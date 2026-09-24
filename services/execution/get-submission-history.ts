import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SubmissionStatus } from "@/types/domain";

export interface SubmissionHistoryItem {
  id: string;
  languageName: string;
  status: SubmissionStatus;
  passedTestCount: number;
  totalTestCount: number;
  runtimeMs: number | null;
  memoryKb: number | null;
  createdAt: string;
}

export interface SubmissionHistoryPage {
  submissions: SubmissionHistoryItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 10;

/**
 * Paginated — see PERFORMANCE: "Do not load the entire submission history
 * initially." RLS (db/schema/012_rls.sql) already scopes this to the
 * caller's own submissions; this uses the normal user-session client, not
 * the admin client, since there's no hidden data involved here — only the
 * caller's own past attempts.
 */
export async function getSubmissionHistory(
  supabase: SupabaseClient,
  userId: string,
  problemId: string,
  page = 1,
): Promise<SubmissionHistoryPage> {
  const from = (page - 1) * PAGE_SIZE;

  const { data, count } = await supabase
    .from("submissions")
    .select("id, status, passed_test_count, total_test_count, runtime_ms, memory_kb, created_at, languages(display_name)", {
      count: "exact",
    })
    .eq("user_id", userId)
    .eq("problem_id", problemId)
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  type Row = {
    id: string;
    status: SubmissionStatus;
    passed_test_count: number;
    total_test_count: number;
    runtime_ms: number | null;
    memory_kb: number | null;
    created_at: string;
    languages: { display_name: string } | null;
  };

  const submissions = ((data as unknown as Row[]) ?? []).map((row) => ({
    id: row.id,
    languageName: row.languages?.display_name ?? "Unknown",
    status: row.status,
    passedTestCount: row.passed_test_count,
    totalTestCount: row.total_test_count,
    runtimeMs: row.runtime_ms,
    memoryKb: row.memory_kb,
    createdAt: row.created_at,
  }));

  return { submissions, totalCount: count ?? 0, page, pageSize: PAGE_SIZE };
}
