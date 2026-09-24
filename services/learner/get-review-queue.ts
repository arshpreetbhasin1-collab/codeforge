import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSkillRecommendations } from "@/services/recommendations/get-next-best-action";
import type { RecommendationType } from "@/lib/recommendations/types";

export type ReviewAction = "REVIEW_LESSON" | "PRACTICE" | "DEBUG" | "TRY_AGAIN";

export interface ReviewQueueItem {
  skillId: string;
  skillSlug: string;
  skillName: string;
  reason: string;
  estimatedMinutes: number;
  action: ReviewAction;
}

const REVIEW_QUEUE_TYPES: readonly RecommendationType[] = ["REINFORCE", "DIAGNOSTIC", "REVIEW"];

const ACTION_FOR_TYPE: Record<string, ReviewAction> = {
  REINFORCE: "DEBUG",
  DIAGNOSTIC: "TRY_AGAIN",
  REVIEW: "REVIEW_LESSON",
};

/** A reasoned estimate, not a measured duration — see PHASE 10: each queue item names "estimated time." Never presented as tracked learning time (that distinction matters for DASHBOARD's "Learning time only if actually tracked"). */
const ESTIMATED_MINUTES_FOR_TYPE: Record<string, number> = {
  REINFORCE: 8,
  DIAGNOSTIC: 5,
  REVIEW: 10,
};

const QUEUE_LIMIT = 10;

/**
 * PHASE 10 — REVIEW MODE: the subset of the recommendation engine's
 * output that represents "something needs revisiting," reshaped for a
 * dedicated queue view. Reuses getSkillRecommendations() rather than
 * recomputing anything — a REINFORCE/DIAGNOSTIC/REVIEW recommendation
 * already IS a review-queue item, just under a different type name.
 */
export async function getReviewQueue(supabase: SupabaseClient, userId: string, now: Date = new Date()): Promise<ReviewQueueItem[]> {
  const recommendations = await getSkillRecommendations(supabase, userId, QUEUE_LIMIT, now);

  return recommendations
    .filter((r) => REVIEW_QUEUE_TYPES.includes(r.type) && r.skillId && r.skillSlug && r.skillName)
    .map((r) => ({
      skillId: r.skillId as string,
      skillSlug: r.skillSlug as string,
      skillName: r.skillName as string,
      reason: r.reasons[0] ?? "",
      estimatedMinutes: ESTIMATED_MINUTES_FOR_TYPE[r.type],
      action: ACTION_FOR_TYPE[r.type],
    }));
}
