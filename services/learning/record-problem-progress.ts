import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordProblemProgressSchema } from "@/lib/validation/schemas";
import { recordLearningEvent } from "./record-learning-event";

export interface ProblemProgressExtra {
  languageId?: string;
  passedTestCount?: number;
  totalTestCount?: number;
}

/**
 * Upserts user_problem_progress (incrementing attempts_count) and records
 * the matching learning event. This is attempt/completion bookkeeping —
 * NOT mastery scoring, which is Prompt 4's job. Execution results (Prompt
 * 3) feed `extra` to track the last language used and the best result
 * achieved so far, without computing anything as strong as a mastery
 * score from it.
 */
export async function recordProblemProgress(
  supabase: SupabaseClient,
  userId: string,
  problemId: string,
  status: "attempted" | "completed",
  extra: ProblemProgressExtra = {},
) {
  recordProblemProgressSchema.parse({ problemId, status });

  const { data: existing } = await supabase
    .from("user_problem_progress")
    .select("id, status, attempts_count, best_passed_test_count, best_total_test_count")
    .eq("user_id", userId)
    .eq("problem_id", problemId)
    .maybeSingle();

  const completedAt = status === "completed" ? new Date().toISOString() : null;
  const isBetterResult = (current: { best_passed_test_count: number }) =>
    extra.passedTestCount !== undefined && extra.passedTestCount > current.best_passed_test_count;

  if (existing) {
    const wasAlreadyCompleted = existing.status === "completed";
    const update: Record<string, unknown> = {
      status: wasAlreadyCompleted ? "completed" : status,
      attempts_count: existing.attempts_count + 1,
    };
    if (status === "completed" && !wasAlreadyCompleted) {
      // Never overwrite the original completion timestamp with a later one.
      update.completed_at = completedAt;
    }
    if (extra.languageId) update.language_id = extra.languageId;
    if (isBetterResult(existing)) {
      update.best_passed_test_count = extra.passedTestCount;
      update.best_total_test_count = extra.totalTestCount ?? existing.best_total_test_count;
    }
    await supabase.from("user_problem_progress").update(update).eq("id", existing.id);
  } else {
    await supabase.from("user_problem_progress").insert({
      user_id: userId,
      problem_id: problemId,
      status,
      attempts_count: 1,
      completed_at: completedAt,
      language_id: extra.languageId ?? null,
      best_passed_test_count: extra.passedTestCount ?? 0,
      best_total_test_count: extra.totalTestCount ?? 0,
    });
  }

  await recordLearningEvent(supabase, userId, {
    eventType: status === "completed" ? "problem_completed" : "problem_attempted",
    problemId,
    metadata: {},
  });
}
