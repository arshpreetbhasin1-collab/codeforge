import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SkillMastery } from "@/types/domain";
import { getNextBestAction as pickNextBestAction, getSkillRecommendations as pickSkillRecommendations } from "@/lib/recommendations/recommendation";
import type { Recommendation } from "@/lib/recommendations/types";
import { buildRecommendationInput } from "@/services/recommendations/get-next-best-action";
import { getMistakeProfile, type MistakeProfile } from "@/services/mistakes/get-mistake-profile";
import { getProjectReadiness, type ProjectReadiness } from "@/services/projects/get-project-readiness";
import { resolveRecommendationDestination } from "@/services/recommendations/resolve-destination";

export interface LearnerProfile {
  userId: string;
  skillMastery: SkillMastery[];
  mistakeProfile: MistakeProfile;
  nextBestAction: Recommendation | null;
  /** Where the "START" button on nextBestAction should go — see PHASE 11. Null only when nothing concrete could be resolved. */
  nextBestActionHref: string | null;
  recommendations: Recommendation[];
  projectReadiness: ProjectReadiness[];
  generatedAt: string;
}

const RECOMMENDATION_LIST_LIMIT = 5;

/**
 * The single read that assembles everything Prompt 4 built into one
 * object — see LEARNER PROFILE: "the UI should never have to call five
 * separate services to render the dashboard." Nothing here computes
 * anything new; it reads already-cached skill_mastery/mistake_patterns
 * and runs the pure recommendation engine once over a shared snapshot.
 */
export async function getLearnerProfile(supabase: SupabaseClient, userId: string, now: Date = new Date()): Promise<LearnerProfile> {
  const [{ data: masteryRows, error: masteryError }, mistakeProfile, projectReadiness, recommendationInput] = await Promise.all([
    supabase
      .from("skill_mastery")
      .select("user_id, skill_id, mastery_score, confidence, success_rate, attempt_count, independent_score, last_reviewed_at, next_review_due_at")
      .eq("user_id", userId),
    getMistakeProfile(supabase, userId),
    getProjectReadiness(supabase, userId),
    buildRecommendationInput(supabase, userId, now),
  ]);

  if (masteryError) throw new Error(`Failed to load skill mastery: ${masteryError.message}`);

  const skillMastery: SkillMastery[] = (masteryRows ?? []).map((row) => ({
    userId: row.user_id,
    skillId: row.skill_id,
    masteryScore: row.mastery_score,
    confidence: row.confidence,
    successRate: row.success_rate,
    attemptCount: row.attempt_count,
    independentScore: row.independent_score,
    lastReviewedAt: row.last_reviewed_at,
    nextReviewDueAt: row.next_review_due_at,
  }));

  const nextBestAction = pickNextBestAction(recommendationInput);
  const nextBestActionHref = nextBestAction ? await resolveRecommendationDestination(supabase, userId, nextBestAction) : null;

  return {
    userId,
    skillMastery,
    mistakeProfile,
    nextBestAction,
    nextBestActionHref,
    recommendations: pickSkillRecommendations(recommendationInput, RECOMMENDATION_LIST_LIMIT),
    projectReadiness,
    generatedAt: now.toISOString(),
  };
}
