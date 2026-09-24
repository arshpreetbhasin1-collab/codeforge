import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface DashboardStats {
  /** Consecutive days (including today or yesterday) with at least one real learning event — 0 if the streak is broken. Real data from user_daily_activity, never fabricated. */
  currentStreak: number;
  skillsMastered: number;
  problemsSolved: number;
}

const MASTERED_THRESHOLD = 95;

/**
 * See PHASE 11: "Current streak if legitimately available... Learning
 * time only if actually tracked." Learning time isn't tracked anywhere
 * in this codebase, so it's deliberately not part of this shape — see
 * DATA INTEGRITY: showing "Not enough data yet" beats fabricating one.
 */
export async function getDashboardStats(supabase: SupabaseClient, userId: string, now: Date = new Date()): Promise<DashboardStats> {
  const [{ data: activityRows }, { data: masteryRows }, { data: submissionRows }] = await Promise.all([
    supabase.from("user_daily_activity").select("activity_date").eq("user_id", userId).order("activity_date", { ascending: false }),
    supabase.from("skill_mastery").select("mastery_score").eq("user_id", userId).gte("mastery_score", MASTERED_THRESHOLD),
    supabase.from("submissions").select("problem_id").eq("user_id", userId).eq("status", "accepted"),
  ]);

  const activityDates = new Set((activityRows ?? []).map((r) => r.activity_date as string));
  const currentStreak = computeStreak(activityDates, now);

  const skillsMastered = masteryRows?.length ?? 0;
  const problemsSolved = new Set((submissionRows ?? []).map((r) => r.problem_id as string)).size;

  return { currentStreak, skillsMastered, problemsSolved };
}

export function computeStreak(activityDates: Set<string>, now: Date): number {
  const todayKey = now.toISOString().slice(0, 10);
  let cursor = new Date(now);

  // If nothing happened today yet, the streak can still be "alive" through yesterday.
  if (!activityDates.has(todayKey)) {
    cursor = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  let streak = 0;
  while (activityDates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }
  return streak;
}
