import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Recommendation } from "@/lib/recommendations/types";
import type { ProblemDifficulty } from "@/types/domain";

const DIFFICULTY_BY_TIER: Record<1 | 2 | 3 | 4 | 5, ProblemDifficulty> = {
  1: "intro",
  2: "easy",
  3: "medium",
  4: "hard",
  5: "boss",
};

/**
 * Resolves a Recommendation to a concrete page to send the learner to —
 * see PHASE 11's "Button: START" and PHASE 12's "Next: Recommended
 * lesson / Recommended problem." The pure recommendation engine only
 * knows about skills; finding an actual not-yet-done lesson/problem for
 * that skill is real I/O and belongs here, not in lib/recommendations.
 * Returns null when nothing concrete can be resolved (never a fabricated
 * link) — the UI falls back to a skill-level destination in that case.
 */
export async function resolveRecommendationDestination(
  supabase: SupabaseClient,
  userId: string,
  recommendation: Recommendation,
): Promise<string | null> {
  if (recommendation.type === "PROJECT_PREP") {
    return "/projects";
  }

  if (recommendation.type === "PROJECT") {
    return recommendation.projectSlug ? `/projects/${recommendation.projectSlug}` : "/projects";
  }

  if (!recommendation.skillId || !recommendation.skillSlug) return null;

  if (recommendation.type === "REVIEW") {
    return `/skill-graph/${recommendation.skillSlug}`;
  }

  if (recommendation.type === "LEARN") {
    return resolveLessonDestination(supabase, userId, recommendation.skillId);
  }

  // PRACTICE, REINFORCE, DIAGNOSTIC, CHALLENGE, TRANSFER — all resolve to a problem.
  return resolveProblemDestination(supabase, userId, recommendation.skillId, recommendation.estimatedDifficulty);
}

async function resolveLessonDestination(supabase: SupabaseClient, userId: string, skillId: string): Promise<string | null> {
  const { data: concepts } = await supabase.from("concepts").select("id").eq("skill_id", skillId);
  const conceptIds = (concepts ?? []).map((c) => c.id as string);
  if (conceptIds.length === 0) return null;

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, slug, module_id, sort_order")
    .in("concept_id", conceptIds)
    .eq("is_published", true)
    .order("sort_order", { ascending: true });
  if (!lessons || lessons.length === 0) return null;

  const { data: completedRows } = await supabase
    .from("user_lesson_progress")
    .select("lesson_id")
    .eq("user_id", userId)
    .eq("status", "completed")
    .in(
      "lesson_id",
      lessons.map((l) => l.id as string),
    );
  const completedIds = new Set((completedRows ?? []).map((r) => r.lesson_id as string));

  const nextLesson = lessons.find((l) => !completedIds.has(l.id as string)) ?? lessons[0];

  const { data: module } = await supabase.from("modules").select("slug").eq("id", nextLesson.module_id).maybeSingle();
  if (!module) return null;

  return `/learn/${module.slug}/${nextLesson.slug}`;
}

async function resolveProblemDestination(
  supabase: SupabaseClient,
  userId: string,
  skillId: string,
  estimatedDifficulty: 1 | 2 | 3 | 4 | 5 | null,
): Promise<string | null> {
  const { data: links } = await supabase.from("problem_skills").select("problem_id").eq("skill_id", skillId).eq("relationship", "teaches");
  const problemIds = (links ?? []).map((l) => l.problem_id as string);
  if (problemIds.length === 0) return null;

  const { data: allProblems } = await supabase
    .from("problems")
    .select("id, slug, difficulty")
    .in("id", problemIds)
    .eq("is_published", true)
    .eq("is_executable", true);
  if (!allProblems || allProblems.length === 0) return null;

  const atTargetDifficulty = estimatedDifficulty ? allProblems.filter((p) => p.difficulty === DIFFICULTY_BY_TIER[estimatedDifficulty]) : [];
  const candidates = atTargetDifficulty.length > 0 ? atTargetDifficulty : allProblems;

  const { data: solvedRows } = await supabase
    .from("submissions")
    .select("problem_id")
    .eq("user_id", userId)
    .eq("status", "accepted")
    .in(
      "problem_id",
      candidates.map((p) => p.id as string),
    );
  const solvedIds = new Set((solvedRows ?? []).map((r) => r.problem_id as string));

  const unsolved = candidates.find((p) => !solvedIds.has(p.id as string)) ?? candidates[0];
  return `/practice/${unsolved.slug}`;
}
