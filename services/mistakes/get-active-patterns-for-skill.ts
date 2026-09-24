import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { summarizeMistakePatterns, type MistakeOccurrence, type MistakePatternSummary } from "@/lib/mistakes/patterns";
import type { MistakeCategory } from "@/types/domain";

/**
 * mistake_patterns (the persisted rollup) is intentionally skill-agnostic
 * — a single category like "off_by_one" can come from problems teaching
 * different skills. For REINFORCE recommendations we need the subset of
 * a user's mistake_events attributable to *this* skill specifically, so
 * this recomputes the same summarizeMistakePatterns() rollup restricted
 * to problems that teach the given skill.
 */
export async function getActivePatternsForSkill(
  supabase: SupabaseClient,
  userId: string,
  skillId: string,
  now: Date = new Date(),
): Promise<MistakePatternSummary[]> {
  const { data: problemLinks, error: problemLinksError } = await supabase
    .from("problem_skills")
    .select("problem_id")
    .eq("skill_id", skillId)
    .eq("relationship", "teaches");

  if (problemLinksError) {
    throw new Error(`Failed to load problems for skill: ${problemLinksError.message}`);
  }

  const problemIds = (problemLinks ?? []).map((row) => row.problem_id as string);
  if (problemIds.length === 0) return [];

  const { data: events, error: eventsError } = await supabase
    .from("mistake_events")
    .select("category, detected_at")
    .eq("user_id", userId)
    .in("problem_id", problemIds);

  if (eventsError) {
    throw new Error(`Failed to load mistake events for skill: ${eventsError.message}`);
  }
  if (!events || events.length === 0) return [];

  const occurrences: MistakeOccurrence[] = events.map((e) => ({
    category: e.category as MistakeCategory,
    detectedAt: new Date(e.detected_at as string),
  }));

  return summarizeMistakePatterns(occurrences, now);
}
