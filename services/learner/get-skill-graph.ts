import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { masteryLevelForScore } from "@/lib/mastery/weights";
import { PREREQUISITE_MASTERY_THRESHOLD } from "@/lib/recommendations/scoring";
import type { MasteryLevel, SkillCategory } from "@/types/domain";

export type SkillGraphStatus = "locked" | "not_started" | "in_progress" | "mastered";

export interface SkillGraphNode {
  skillId: string;
  skillSlug: string;
  skillName: string;
  category: SkillCategory;
  difficulty: 1 | 2 | 3 | 4 | 5;
  masteryScore: number;
  level: MasteryLevel;
  prerequisiteSkillIds: string[];
  prerequisitesMet: boolean;
  status: SkillGraphStatus;
}

/**
 * Real prerequisite DAG (skills + skill_dependencies) annotated with this
 * learner's actual mastery — see PHASE 12: "Display the actual
 * prerequisite DAG," not a generic chart. `status` folds mastery level +
 * prerequisite state into one of 4 values the UI renders as text/icon,
 * never color alone — see PHASE 12: "must NOT rely on color alone."
 */
export async function getSkillGraph(supabase: SupabaseClient, userId: string): Promise<SkillGraphNode[]> {
  const [{ data: skills, error: skillsError }, { data: dependencies, error: depsError }, { data: masteryRows, error: masteryError }] =
    await Promise.all([
      supabase.from("skills").select("id, slug, name, category, difficulty"),
      supabase.from("skill_dependencies").select("skill_id, prerequisite_skill_id"),
      supabase.from("skill_mastery").select("skill_id, mastery_score, attempt_count").eq("user_id", userId),
    ]);

  if (skillsError) throw new Error(`Failed to load skills: ${skillsError.message}`);
  if (depsError) throw new Error(`Failed to load skill dependencies: ${depsError.message}`);
  if (masteryError) throw new Error(`Failed to load skill mastery: ${masteryError.message}`);

  const masteryBySkill = new Map((masteryRows ?? []).map((r) => [r.skill_id as string, r.mastery_score as number]));
  const attemptCountBySkill = new Map((masteryRows ?? []).map((r) => [r.skill_id as string, r.attempt_count as number]));

  const prereqsBySkill = new Map<string, string[]>();
  for (const dep of dependencies ?? []) {
    const list = prereqsBySkill.get(dep.skill_id as string) ?? [];
    list.push(dep.prerequisite_skill_id as string);
    prereqsBySkill.set(dep.skill_id as string, list);
  }

  return (skills ?? []).map((skill) => {
    const masteryScore = masteryBySkill.get(skill.id as string) ?? 0;
    const level = masteryLevelForScore(masteryScore);
    const prerequisiteSkillIds = prereqsBySkill.get(skill.id as string) ?? [];
    const prerequisitesMet = prerequisiteSkillIds.every((id) => (masteryBySkill.get(id) ?? 0) >= PREREQUISITE_MASTERY_THRESHOLD);

    // "Locked" means genuinely untouched AND gated — real attempt evidence
    // always wins over the prerequisite gate, since nothing in the app
    // actually blocks solving a problem before its prerequisite is
    // mastered; the gate is a recommendation signal, not access control.
    const hasEvidence = (attemptCountBySkill.get(skill.id as string) ?? 0) > 0;
    let status: SkillGraphStatus;
    if (level === "mastered") status = "mastered";
    else if (!hasEvidence && !prerequisitesMet) status = "locked";
    else if (!hasEvidence) status = "not_started";
    else status = "in_progress";

    return {
      skillId: skill.id as string,
      skillSlug: skill.slug as string,
      skillName: skill.name as string,
      category: skill.category as SkillCategory,
      difficulty: skill.difficulty as 1 | 2 | 3 | 4 | 5,
      masteryScore,
      level,
      prerequisiteSkillIds,
      prerequisitesMet,
      status,
    };
  });
}
