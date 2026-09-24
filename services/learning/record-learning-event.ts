import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordLearningEventSchema, type RecordLearningEventInput } from "@/lib/validation/schemas";

/**
 * The single write path for learning_events (see LEARNING EVENT MODEL).
 * Every future progress metric must be traceable to a row this function
 * wrote — do not compute progress from anywhere else.
 */
export async function recordLearningEvent(
  supabase: SupabaseClient,
  userId: string,
  input: RecordLearningEventInput,
) {
  const parsed = recordLearningEventSchema.parse(input);

  const { error } = await supabase.from("learning_events").insert({
    user_id: userId,
    event_type: parsed.eventType,
    skill_id: parsed.skillId ?? null,
    problem_id: parsed.problemId ?? null,
    lesson_id: parsed.lessonId ?? null,
    submission_id: parsed.submissionId ?? null,
    project_id: parsed.projectId ?? null,
    project_submission_id: parsed.projectSubmissionId ?? null,
    metadata: parsed.metadata,
  });

  if (error) {
    throw new Error(`Failed to record learning event: ${error.message}`);
  }

  try {
    await bumpDailyActivity(supabase, userId);
  } catch (dailyActivityError) {
    console.error("[learning] bumpDailyActivity failed", dailyActivityError);
  }
}

/**
 * Foundation for a future streak (see STREAKS / GAMIFICATION — data
 * structure only, no streak UI yet). Best-effort: a failure here must
 * never fail the learning event it's attached to.
 */
async function bumpDailyActivity(supabase: SupabaseClient, userId: string) {
  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("user_daily_activity")
    .select("id, event_count")
    .eq("user_id", userId)
    .eq("activity_date", today)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("user_daily_activity")
      .update({ event_count: existing.event_count + 1 })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("user_daily_activity")
      .insert({ user_id: userId, activity_date: today, event_count: 1 });
  }
}
