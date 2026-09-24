import type { UUID } from "@/types/domain";
import { getUnlockedSkills, type SkillGraph } from "./skill-graph";

/**
 * Personalized learning path architecture (see LEARNING PATH ARCHITECTURE).
 *
 * A curriculum's module order is a *default*, not a forced sequence — this
 * function decides what a specific student should see next by combining the
 * skill graph with their mastery state. Two students on the same curriculum
 * can legitimately get different next-skill recommendations.
 *
 * Prompt 4 owns the real adaptive algorithm (weighting weak skills, spaced
 * repetition due dates, etc). This is the interface + a naive default
 * implementation so the rest of the app (dashboard, "Continue Learning" CTA)
 * has something real to call against today.
 */

export interface MasteryLookup {
  /** skillId -> mastery score 0-100. Missing entry = never attempted. */
  scoreBySkillId: Map<UUID, number>;
}

export interface NextSkillRecommendation {
  skillId: UUID;
  reason: "unlocked_unattempted" | "unlocked_low_mastery" | "no_unlocked_skill_available";
}

const MASTERY_THRESHOLD = 80;

export function recommendNextSkill(
  graph: SkillGraph,
  mastery: MasteryLookup,
): NextSkillRecommendation | null {
  const masteredSkillIds = new Set(
    [...mastery.scoreBySkillId.entries()]
      .filter(([, score]) => score >= MASTERY_THRESHOLD)
      .map(([skillId]) => skillId),
  );

  const unlocked = getUnlockedSkills(graph, masteredSkillIds).filter(
    (skill) => !masteredSkillIds.has(skill.id),
  );

  if (unlocked.length === 0) return null;

  const neverAttempted = unlocked.find((skill) => !mastery.scoreBySkillId.has(skill.id));
  if (neverAttempted) {
    return { skillId: neverAttempted.id, reason: "unlocked_unattempted" };
  }

  const weakest = unlocked.reduce((lowest, skill) => {
    const score = mastery.scoreBySkillId.get(skill.id) ?? 0;
    const lowestScore = mastery.scoreBySkillId.get(lowest.id) ?? 0;
    return score < lowestScore ? skill : lowest;
  }, unlocked[0]);

  return { skillId: weakest.id, reason: "unlocked_low_mastery" };
}
