import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getNextBestAction as pickNextBestAction,
  getSkillRecommendations as pickSkillRecommendations,
} from "@/lib/recommendations/recommendation";
import type { RecommendationInput, SkillCandidate, SiblingLanguageMastery, ProjectProximity, Recommendation, LearnerPreferences } from "@/lib/recommendations/types";
import { PREREQUISITE_MASTERY_THRESHOLD, PROJECT_PREP_MIN_READINESS } from "@/lib/recommendations/scoring";
import { masteryLevelForScore } from "@/lib/mastery/weights";
import { estimateRetention } from "@/lib/mastery/decay";
import { summarizeMistakePatterns, type MistakeOccurrence } from "@/lib/mistakes/patterns";
import { getLanguageMasteryBreakdown } from "@/services/mastery/get-language-mastery-breakdown";
import { getProjectReadiness } from "@/services/projects/get-project-readiness";
import type { MistakeCategory, MasteryLevel, SkillCategory } from "@/types/domain";

const STRETCH_LEVELS = new Set<MasteryLevel>(["strong", "mastered"]);

/**
 * Assembles the pure lib/recommendations/recommendation.ts input from
 * real Supabase state — the only place that translates skill_mastery /
 * skill_dependencies / mistake_events / projects rows into recommendation
 * evidence. Batches mistake-pattern attribution across all skills in a
 * handful of queries rather than one per skill; the per-language mastery
 * breakdown (needed only for CHALLENGE/TRANSFER) is fetched lazily, only
 * for skills already at "strong" or "mastered" — most skills never reach
 * that branch, so this avoids querying it for every skill on every load.
 */
export async function buildRecommendationInput(supabase: SupabaseClient, userId: string, now: Date = new Date()): Promise<RecommendationInput> {
  const [
    { data: skills, error: skillsError },
    { data: dependencies, error: depsError },
    { data: masteryRows, error: masteryError },
    preferences,
  ] = await Promise.all([
    supabase.from("skills").select("id, slug, name, category, language_id"),
    supabase.from("skill_dependencies").select("skill_id, prerequisite_skill_id"),
    supabase
      .from("skill_mastery")
      .select("skill_id, mastery_score, confidence, success_rate, attempt_count, independent_score, last_reviewed_at")
      .eq("user_id", userId),
    getLearnerPreferences(supabase, userId),
  ]);

  if (skillsError) throw new Error(`Failed to load skills: ${skillsError.message}`);
  if (depsError) throw new Error(`Failed to load skill dependencies: ${depsError.message}`);
  if (masteryError) throw new Error(`Failed to load skill mastery: ${masteryError.message}`);

  const masteryBySkill = new Map((masteryRows ?? []).map((r) => [r.skill_id as string, r]));

  const prereqsBySkill = new Map<string, string[]>();
  for (const dep of dependencies ?? []) {
    const list = prereqsBySkill.get(dep.skill_id as string) ?? [];
    list.push(dep.prerequisite_skill_id as string);
    prereqsBySkill.set(dep.skill_id as string, list);
  }

  const occurrencesBySkill = await getMistakeOccurrencesBySkill(supabase, userId);

  const candidates: SkillCandidate[] = [];
  for (const skill of skills ?? []) {
    const masteryRow = masteryBySkill.get(skill.id as string);
    const masteryScore = (masteryRow?.mastery_score as number | undefined) ?? 0;
    const level = masteryLevelForScore(masteryScore);

    const prereqIds = prereqsBySkill.get(skill.id as string) ?? [];
    const prerequisitesSatisfied = prereqIds.every(
      (id) => ((masteryBySkill.get(id)?.mastery_score as number | undefined) ?? 0) >= PREREQUISITE_MASTERY_THRESHOLD,
    );

    const lastReviewedAt = masteryRow?.last_reviewed_at as string | null | undefined;
    const retention = lastReviewedAt ? estimateRetention(masteryScore, new Date(lastReviewedAt), now) : null;

    const activePatterns = summarizeMistakePatterns(occurrencesBySkill.get(skill.id as string) ?? [], now);

    let languageSlug: string | null = null;
    let siblingLanguages: SiblingLanguageMastery[] = [];
    if (STRETCH_LEVELS.has(level)) {
      const breakdown = await getLanguageMasteryBreakdown(supabase, userId, skill.id as string, now);
      if (breakdown.length > 0) {
        const sorted = [...breakdown].sort((a, b) => b.masteryScore - a.masteryScore);
        languageSlug = sorted[0].languageSlug;
        siblingLanguages = sorted.slice(1);
      }
    }

    candidates.push({
      skillId: skill.id as string,
      skillSlug: skill.slug as string,
      skillName: skill.name as string,
      category: skill.category as SkillCategory,
      languageSlug,
      prerequisitesSatisfied,
      mastery: {
        masteryScore,
        confidence: (masteryRow?.confidence as number | undefined) ?? 0,
        successRate: (masteryRow?.success_rate as number | undefined) ?? 0,
        independentScore: (masteryRow?.independent_score as number | null | undefined) ?? null,
        level,
        evidenceCount: (masteryRow?.attempt_count as number | undefined) ?? 0,
        explanation: [],
      },
      retention,
      activePatterns,
      siblingLanguages,
    });
  }

  // Includes both "almost there" (>= PROJECT_PREP_MIN_READINESS) and fully
  // ready projects — classifyProjectRecommendation/classifyProjectReadyRecommendation
  // in lib/recommendations/recommendation.ts decide which of PROJECT_PREP/
  // PROJECT (or neither) applies to each.
  const projectReadiness = await getProjectReadiness(supabase, userId);
  const nearReadyProjects: ProjectProximity[] = projectReadiness
    .filter((p) => p.isReady || p.readinessScore >= PROJECT_PREP_MIN_READINESS)
    .map((p) => ({
      projectId: p.projectId,
      projectSlug: p.projectSlug,
      projectTitle: p.projectTitle,
      readinessScore: p.readinessScore,
      isReady: p.isReady,
      missingSkillNames: p.missingSkills.map((s) => s.skillName),
      explanation: p.explanation,
      progressVerdict: p.progressVerdict,
    }));

  return { skills: candidates, nearReadyProjects, preferences, now };
}

/** Onboarding preferences (Prompt 5) — resolves preferred_language_id to the slug the recommendation engine compares against SkillCandidate.languageSlug. */
async function getLearnerPreferences(supabase: SupabaseClient, userId: string): Promise<LearnerPreferences> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_language_id, experience_level, learning_goal")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    return { preferredLanguageSlug: null, experienceLevel: null, learningGoal: null };
  }

  let preferredLanguageSlug: string | null = null;
  if (profile.preferred_language_id) {
    const { data: language } = await supabase.from("languages").select("slug").eq("id", profile.preferred_language_id).maybeSingle();
    preferredLanguageSlug = (language?.slug as string | undefined) ?? null;
  }

  return {
    preferredLanguageSlug,
    experienceLevel: profile.experience_level,
    learningGoal: profile.learning_goal,
  };
}

async function getMistakeOccurrencesBySkill(supabase: SupabaseClient, userId: string): Promise<Map<string, MistakeOccurrence[]>> {
  const { data: events, error: eventsError } = await supabase
    .from("mistake_events")
    .select("category, detected_at, problem_id")
    .eq("user_id", userId);

  if (eventsError) throw new Error(`Failed to load mistake events: ${eventsError.message}`);
  if (!events || events.length === 0) return new Map();

  const problemIds = [...new Set(events.map((e) => e.problem_id as string))];
  const { data: links, error: linksError } = await supabase
    .from("problem_skills")
    .select("problem_id, skill_id")
    .in("problem_id", problemIds)
    .eq("relationship", "teaches");

  if (linksError) throw new Error(`Failed to load problem-skill links: ${linksError.message}`);

  const skillsByProblem = new Map<string, string[]>();
  for (const link of links ?? []) {
    const list = skillsByProblem.get(link.problem_id as string) ?? [];
    list.push(link.skill_id as string);
    skillsByProblem.set(link.problem_id as string, list);
  }

  const occurrencesBySkill = new Map<string, MistakeOccurrence[]>();
  for (const event of events) {
    const skillIds = skillsByProblem.get(event.problem_id as string) ?? [];
    const occurrence: MistakeOccurrence = { category: event.category as MistakeCategory, detectedAt: new Date(event.detected_at as string) };
    for (const skillId of skillIds) {
      const list = occurrencesBySkill.get(skillId) ?? [];
      list.push(occurrence);
      occurrencesBySkill.set(skillId, list);
    }
  }

  return occurrencesBySkill;
}

export async function getNextBestAction(supabase: SupabaseClient, userId: string, now: Date = new Date()): Promise<Recommendation | null> {
  const input = await buildRecommendationInput(supabase, userId, now);
  return pickNextBestAction(input);
}

export async function getSkillRecommendations(supabase: SupabaseClient, userId: string, limit: number, now: Date = new Date()): Promise<Recommendation[]> {
  const input = await buildRecommendationInput(supabase, userId, now);
  return pickSkillRecommendations(input, limit);
}
