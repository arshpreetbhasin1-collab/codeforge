import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiLearnerContext } from "@/lib/ai/context";
import { getLearnerProfile } from "@/services/learner/get-learner-profile";
import { masteryLevelForScore } from "@/lib/mastery/weights";
import { MISTAKE_CATEGORY_LABEL } from "@/lib/mistakes/taxonomy";

const RECENT_ATTEMPTS_LIMIT = 5;
const RELEVANT_LESSONS_LIMIT = 3;

/**
 * Assembles AiLearnerContext from real, already-computed data — see
 * lib/ai/context.ts. No AI provider is called here or anywhere in this
 * file; this is data preparation only, ready for a future prompt to wire
 * to an actual AI mentor.
 */
export async function getAiLearnerContext(supabase: SupabaseClient, userId: string, now: Date = new Date()): Promise<AiLearnerContext> {
  const [{ data: profileRow }, learnerProfile] = await Promise.all([
    supabase.from("profiles").select("display_name, experience_level, learning_goal, preferred_language_id").eq("id", userId).maybeSingle(),
    getLearnerProfile(supabase, userId, now),
  ]);

  let preferredLanguageSlug: string | null = null;
  if (profileRow?.preferred_language_id) {
    const { data: language } = await supabase.from("languages").select("slug").eq("id", profileRow.preferred_language_id).maybeSingle();
    preferredLanguageSlug = (language?.slug as string | undefined) ?? null;
  }

  const skillIds = learnerProfile.skillMastery.map((m) => m.skillId);
  const { data: skillRows } = skillIds.length
    ? await supabase.from("skills").select("id, name").in("id", skillIds)
    : { data: [] as { id: string; name: string }[] };
  const skillNameById = new Map((skillRows ?? []).map((s) => [s.id as string, s.name as string]));

  const skillMastery = learnerProfile.skillMastery
    .map((m) => ({
      skillName: skillNameById.get(m.skillId) ?? "Unknown skill",
      masteryScore: m.masteryScore,
      level: masteryLevelForScore(m.masteryScore),
      confidence: m.confidence,
    }))
    .sort((a, b) => b.masteryScore - a.masteryScore);

  const { data: submissionRows } = await supabase
    .from("submissions")
    .select("problem_id, language_id, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(RECENT_ATTEMPTS_LIMIT);

  const attemptProblemIds = [...new Set((submissionRows ?? []).map((s) => s.problem_id as string))];
  const attemptLanguageIds = [...new Set((submissionRows ?? []).map((s) => s.language_id as string))];
  const [{ data: attemptProblems }, { data: attemptLanguages }] = await Promise.all([
    attemptProblemIds.length ? supabase.from("problems").select("id, title").in("id", attemptProblemIds) : Promise.resolve({ data: [] }),
    attemptLanguageIds.length ? supabase.from("languages").select("id, slug").in("id", attemptLanguageIds) : Promise.resolve({ data: [] }),
  ]);
  const problemTitleById = new Map((attemptProblems ?? []).map((p) => [p.id as string, p.title as string]));
  const languageSlugById = new Map((attemptLanguages ?? []).map((l) => [l.id as string, l.slug as string]));

  const recentAttempts = (submissionRows ?? []).map((s) => ({
    problemTitle: problemTitleById.get(s.problem_id as string) ?? "Unknown problem",
    verdict: s.status as string,
    languageSlug: languageSlugById.get(s.language_id as string) ?? "unknown",
    submittedAt: s.created_at as string,
  }));

  const mistakeDNA = learnerProfile.mistakeProfile.topPatterns.map((p) => {
    const category = p.patternKey as keyof typeof MISTAKE_CATEGORY_LABEL;
    return {
      category,
      label: MISTAKE_CATEGORY_LABEL[category] ?? p.description,
      occurrenceCount: p.occurrenceCount,
      lastSeenAt: p.lastSeenAt,
    };
  });

  const relevantLessons = learnerProfile.nextBestAction?.skillId
    ? await getLessonsForSkill(supabase, learnerProfile.nextBestAction.skillId, RELEVANT_LESSONS_LIMIT)
    : [];

  return {
    learnerProfile: {
      displayName: (profileRow?.display_name as string | null) ?? null,
      experienceLevel: (profileRow?.experience_level as AiLearnerContext["learnerProfile"]["experienceLevel"]) ?? null,
      learningGoal: (profileRow?.learning_goal as AiLearnerContext["learnerProfile"]["learningGoal"]) ?? null,
      preferredLanguageSlug,
    },
    skillMastery,
    recentAttempts,
    mistakeDNA,
    recommendation: learnerProfile.nextBestAction,
    relevantLessons,
    generatedAt: now.toISOString(),
  };
}

async function getLessonsForSkill(supabase: SupabaseClient, skillId: string, limit: number) {
  const { data: concepts } = await supabase.from("concepts").select("id").eq("skill_id", skillId);
  const conceptIds = (concepts ?? []).map((c) => c.id as string);
  if (conceptIds.length === 0) return [];

  const { data: lessons } = await supabase
    .from("lessons")
    .select("title, slug, module_id, sort_order")
    .in("concept_id", conceptIds)
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .limit(limit);

  const moduleIds = [...new Set((lessons ?? []).map((l) => l.module_id as string))];
  const { data: modules } = moduleIds.length ? await supabase.from("modules").select("id, slug").in("id", moduleIds) : { data: [] };
  const moduleSlugById = new Map((modules ?? []).map((m) => [m.id as string, m.slug as string]));

  return (lessons ?? []).map((l) => ({
    title: l.title as string,
    slug: l.slug as string,
    moduleSlug: moduleSlugById.get(l.module_id as string) ?? "",
  }));
}
