import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateSkillMastery } from "@/lib/mastery/mastery";
import { estimateRetention, type RetentionEstimate } from "@/lib/mastery/decay";
import type { MasteryResult } from "@/lib/mastery/types";
import { getSkillEvidence } from "@/services/mastery/get-skill-evidence";
import { getActivePatternsForSkill } from "@/services/mistakes/get-active-patterns-for-skill";
import { MISTAKE_CATEGORY_LABEL } from "@/lib/mistakes/taxonomy";
import { PREREQUISITE_MASTERY_THRESHOLD } from "@/lib/recommendations/scoring";
import { resolveRecommendationDestination } from "@/services/recommendations/resolve-destination";
import { classifySkillRecommendation } from "@/lib/recommendations/recommendation";
import type { SkillCategory } from "@/types/domain";

export interface SkillDetailPrerequisite {
  skillId: string;
  skillName: string;
  masteryScore: number;
  met: boolean;
}

export interface SkillDetailMistake {
  category: string;
  label: string;
  occurrenceCount: number;
}

export interface SkillDetail {
  skillId: string;
  skillSlug: string;
  skillName: string;
  category: SkillCategory;
  mastery: MasteryResult;
  retention: RetentionEstimate | null;
  prerequisites: SkillDetailPrerequisite[];
  problemsAttempted: number;
  problemsPassed: number;
  commonMistakes: SkillDetailMistake[];
  recommendedHref: string | null;
}

/**
 * Everything the Skill Detail view (PHASE 12) shows for one skill —
 * assembled from the same real evidence the mastery/mistake/
 * recommendation engines already compute, nothing new invented.
 */
export async function getSkillDetail(supabase: SupabaseClient, userId: string, skillSlug: string, now: Date = new Date()): Promise<SkillDetail | null> {
  const { data: skill } = await supabase.from("skills").select("id, slug, name, category").eq("slug", skillSlug).maybeSingle();
  if (!skill) return null;

  const skillId = skill.id as string;

  const [evidence, activePatterns, { data: dependencies }] = await Promise.all([
    getSkillEvidence(supabase, userId, skillId),
    getActivePatternsForSkill(supabase, userId, skillId, now),
    supabase.from("skill_dependencies").select("prerequisite_skill_id").eq("skill_id", skillId),
  ]);

  const mastery = calculateSkillMastery(evidence, now);

  const { data: masteryRow } = await supabase
    .from("skill_mastery")
    .select("last_reviewed_at")
    .eq("user_id", userId)
    .eq("skill_id", skillId)
    .maybeSingle();
  const retention = masteryRow?.last_reviewed_at ? estimateRetention(mastery.masteryScore, new Date(masteryRow.last_reviewed_at as string), now) : null;

  const prereqIds = (dependencies ?? []).map((d) => d.prerequisite_skill_id as string);
  let prerequisites: SkillDetailPrerequisite[] = [];
  if (prereqIds.length > 0) {
    const [{ data: prereqSkills }, { data: prereqMastery }] = await Promise.all([
      supabase.from("skills").select("id, name").in("id", prereqIds),
      supabase.from("skill_mastery").select("skill_id, mastery_score").eq("user_id", userId).in("skill_id", prereqIds),
    ]);
    const nameById = new Map((prereqSkills ?? []).map((s) => [s.id as string, s.name as string]));
    const masteryById = new Map((prereqMastery ?? []).map((m) => [m.skill_id as string, m.mastery_score as number]));
    prerequisites = prereqIds.map((id) => {
      const masteryScore = masteryById.get(id) ?? 0;
      return { skillId: id, skillName: nameById.get(id) ?? "Unknown skill", masteryScore, met: masteryScore >= PREREQUISITE_MASTERY_THRESHOLD };
    });
  }

  const problemsAttempted = evidence.length;
  const problemsPassed = evidence.filter((e) => e.passed).length;

  const commonMistakes: SkillDetailMistake[] = activePatterns
    .filter((p) => p.isActive)
    .map((p) => ({ category: p.category, label: MISTAKE_CATEGORY_LABEL[p.category], occurrenceCount: p.occurrenceCount }))
    .sort((a, b) => b.occurrenceCount - a.occurrenceCount);

  const prerequisitesSatisfied = prerequisites.every((p) => p.met);
  const recommendation = classifySkillRecommendation({
    skillId,
    skillSlug: skill.slug as string,
    skillName: skill.name as string,
    category: skill.category as SkillCategory,
    languageSlug: null,
    prerequisitesSatisfied,
    mastery,
    retention,
    activePatterns,
    siblingLanguages: [],
  });
  const recommendedHref = recommendation ? await resolveRecommendationDestination(supabase, userId, recommendation) : null;

  return {
    skillId,
    skillSlug: skill.slug as string,
    skillName: skill.name as string,
    category: skill.category as SkillCategory,
    mastery,
    retention,
    prerequisites,
    problemsAttempted,
    problemsPassed,
    commonMistakes,
    recommendedHref,
  };
}
