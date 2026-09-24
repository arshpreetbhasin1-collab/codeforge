"use server";

import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { runCode, type RunCodeResult } from "@/services/execution/run-code";
import { submitCode, type SubmitCodeResult } from "@/services/execution/submit-code";
import { getSubmissionHistory, type SubmissionHistoryPage } from "@/services/execution/get-submission-history";
import { getSubmissionDetail, type SubmissionDetail } from "@/services/execution/get-submission-detail";
import { getNextRecommendedProblem, type NextRecommendedProblem } from "@/services/learning/get-next-recommended-problem";
import type { CodeRunInput, CodeSubmissionInput } from "@/lib/validation/schemas";

/**
 * Server Actions the problem page calls. Every one derives the
 * authenticated user server-side — see AUTHORIZATION: "Never trust user_id
 * from the request body." Execution itself always happens through
 * services/execution/*, never inline here — see MOST IMPORTANT SECURITY
 * RULE.
 */

async function requireUserId(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not authenticated.");
  }
  return user.id;
}

export async function runCodeAction(input: CodeRunInput): Promise<RunCodeResult> {
  const supabase = await createSupabaseServerClient();
  const userId = await requireUserId();
  return runCode(supabase, userId, input);
}

export async function submitCodeAction(input: CodeSubmissionInput): Promise<SubmitCodeResult> {
  const supabase = await createSupabaseServerClient();
  const userId = await requireUserId();
  return submitCode(supabase, userId, input);
}

export async function getSubmissionHistoryAction(problemId: string, page: number): Promise<SubmissionHistoryPage> {
  const supabase = await createSupabaseServerClient();
  const userId = await requireUserId();
  return getSubmissionHistory(supabase, userId, problemId, page);
}

export async function getSubmissionDetailAction(submissionId: string): Promise<SubmissionDetail | null> {
  const userId = await requireUserId();
  return getSubmissionDetail(userId, submissionId);
}

export async function getNextRecommendedProblemAction(solvedProblemId: string): Promise<NextRecommendedProblem | null> {
  const supabase = await createSupabaseServerClient();
  const userId = await requireUserId();
  return getNextRecommendedProblem(supabase, userId, solvedProblemId);
}
