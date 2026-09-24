import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateSkillMastery } from "@/lib/mastery/mastery";
import { computeNextReviewDueAt } from "@/lib/mastery/schedule";
import type { MasteryResult } from "@/lib/mastery/types";
import { getSkillEvidence } from "./get-skill-evidence";
import { recordLearningEvent } from "@/services/learning/record-learning-event";

/**
 * Recomputes and persists one (user, skill) mastery row from real
 * evidence — see MASTERY MODEL: "recalculation must be targeted, not a
 * full recompute of every skill on every submission." Callers (e.g.
 * services/execution/submit-code.ts) only invoke this for the specific
 * skill(s) a submission is evidence for. Logs a skill_mastery_updated
 * learning event only when the stored score actually changes — see
 * LEARNING EVENTS: "Do NOT create events merely to inflate analytics."
 */
export async function recalculateSkillMastery(
  supabase: SupabaseClient,
  userId: string,
  skillId: string,
  now: Date = new Date(),
): Promise<MasteryResult> {
  const { data: existing } = await supabase
    .from("skill_mastery")
    .select("mastery_score")
    .eq("user_id", userId)
    .eq("skill_id", skillId)
    .maybeSingle();
  const previousScore = existing?.mastery_score as number | undefined;

  const evidence = await getSkillEvidence(supabase, userId, skillId);
  const result = calculateSkillMastery(evidence, now);

  const lastAttempt = evidence.length > 0 ? evidence[evidence.length - 1].attemptedAt : null;
  const nextReviewDueAt = lastAttempt ? computeNextReviewDueAt(result.level, lastAttempt) : null;

  const { error } = await supabase.from("skill_mastery").upsert(
    {
      user_id: userId,
      skill_id: skillId,
      mastery_score: result.masteryScore,
      confidence: result.confidence,
      success_rate: result.successRate,
      attempt_count: result.evidenceCount,
      independent_score: result.independentScore,
      last_reviewed_at: lastAttempt ? lastAttempt.toISOString() : null,
      next_review_due_at: nextReviewDueAt ? nextReviewDueAt.toISOString() : null,
    },
    { onConflict: "user_id,skill_id" },
  );

  if (error) {
    throw new Error(`Failed to persist skill mastery: ${error.message}`);
  }

  if (previousScore === undefined || previousScore !== result.masteryScore) {
    await recordLearningEvent(supabase, userId, {
      eventType: "skill_mastery_updated",
      skillId,
      metadata: { previousScore: previousScore ?? null, newScore: result.masteryScore, level: result.level },
    });
  }

  return result;
}

/** Every skill a given problem is evidence for — what submit-code.ts uses to know which skills to recalculate after a submission. */
export async function getSkillIdsTaughtByProblem(supabase: SupabaseClient, problemId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("problem_skills")
    .select("skill_id")
    .eq("problem_id", problemId)
    .eq("relationship", "teaches");

  if (error) {
    throw new Error(`Failed to load skills for problem: ${error.message}`);
  }
  return (data ?? []).map((row) => row.skill_id as string);
}

/** Every skill a given project is evidence for — what submit-project-stage.ts uses to know which skills to recalculate after a submission. */
export async function getSkillIdsDemonstratedByProject(supabase: SupabaseClient, projectId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("project_skills")
    .select("skill_id")
    .eq("project_id", projectId)
    .eq("relationship", "demonstrates");

  if (error) {
    throw new Error(`Failed to load skills for project: ${error.message}`);
  }
  return (data ?? []).map((row) => row.skill_id as string);
}
