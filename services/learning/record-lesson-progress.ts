import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordLessonProgressSchema } from "@/lib/validation/schemas";
import { recordLearningEvent } from "./record-learning-event";

/**
 * Upserts user_lesson_progress and records the matching learning event.
 * Simple completion state — NOT the mastery engine (Prompt 4 owns that).
 */
export async function recordLessonProgress(
  supabase: SupabaseClient,
  userId: string,
  lessonId: string,
  status: "in_progress" | "completed",
) {
  recordLessonProgressSchema.parse({ lessonId, status });

  const { data: existing } = await supabase
    .from("user_lesson_progress")
    .select("id, status")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  const completedAt = status === "completed" ? new Date().toISOString() : null;

  if (existing) {
    if (existing.status === "completed" && status === "in_progress") {
      // Never regress a completed lesson back to in_progress.
      return;
    }
    await supabase
      .from("user_lesson_progress")
      .update({ status, completed_at: completedAt })
      .eq("id", existing.id);
  } else {
    await supabase.from("user_lesson_progress").insert({
      user_id: userId,
      lesson_id: lessonId,
      status,
      completed_at: completedAt,
    });
  }

  await recordLearningEvent(supabase, userId, {
    eventType: status === "completed" ? "lesson_completed" : "lesson_started",
    lessonId,
    metadata: {},
  });
}
