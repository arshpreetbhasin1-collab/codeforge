import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface UserLearningProgress {
  /** lessonId -> status */
  lessonStatusById: Map<string, "in_progress" | "completed">;
  /** problemId -> status */
  problemStatusById: Map<string, "attempted" | "completed">;
  completedLessonCount: number;
  completedProblemCount: number;
}

/**
 * Loads a student's simple completion state — the input
 * lib/learning/path.ts and the dashboard/practice pages render from.
 * Not the mastery engine (services/mastery) and not a substitute for it.
 */
export async function getUserLearningProgress(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserLearningProgress> {
  const [{ data: lessonRows }, { data: problemRows }] = await Promise.all([
    supabase.from("user_lesson_progress").select("lesson_id, status").eq("user_id", userId),
    supabase.from("user_problem_progress").select("problem_id, status").eq("user_id", userId),
  ]);

  const lessonStatusById = new Map<string, "in_progress" | "completed">(
    (lessonRows ?? []).map((row) => [row.lesson_id as string, row.status]),
  );
  const problemStatusById = new Map<string, "attempted" | "completed">(
    (problemRows ?? []).map((row) => [row.problem_id as string, row.status]),
  );

  return {
    lessonStatusById,
    problemStatusById,
    completedLessonCount: [...lessonStatusById.values()].filter((s) => s === "completed").length,
    completedProblemCount: [...problemStatusById.values()].filter((s) => s === "completed").length,
  };
}
