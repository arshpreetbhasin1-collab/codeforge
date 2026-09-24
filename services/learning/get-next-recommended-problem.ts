import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface NextRecommendedProblem {
  slug: string;
  title: string;
  difficulty: string;
}

/**
 * "Next recommended problem" after an ACCEPTED verdict — see ACCEPTED
 * EXPERIENCE. Naive on purpose: same skill, next progression level,
 * prerequisite ordering. Prompt 4's adaptive engine replaces this without
 * changing the call site.
 */
export async function getNextRecommendedProblem(
  supabase: SupabaseClient,
  userId: string,
  solvedProblemId: string,
): Promise<NextRecommendedProblem | null> {
  const { data: skillLinks } = await supabase
    .from("problem_skills")
    .select("skill_id")
    .eq("problem_id", solvedProblemId)
    .eq("relationship", "teaches");

  const skillIds = (skillLinks ?? []).map((l) => l.skill_id);
  if (skillIds.length === 0) return null;

  const { data: candidateLinks } = await supabase
    .from("problem_skills")
    .select("problem_id")
    .in("skill_id", skillIds)
    .eq("relationship", "teaches");

  const candidateIds = [...new Set((candidateLinks ?? []).map((l) => l.problem_id))].filter(
    (id) => id !== solvedProblemId,
  );
  if (candidateIds.length === 0) return null;

  const { data: completedRows } = await supabase
    .from("user_problem_progress")
    .select("problem_id")
    .eq("user_id", userId)
    .eq("status", "completed")
    .in("problem_id", candidateIds);

  const completedIds = new Set((completedRows ?? []).map((r) => r.problem_id));
  const remainingIds = candidateIds.filter((id) => !completedIds.has(id));
  if (remainingIds.length === 0) return null;

  const { data: candidates } = await supabase
    .from("problems")
    .select("slug, title, difficulty, progression_level")
    .in("id", remainingIds)
    .eq("is_published", true)
    .eq("is_executable", true)
    .order("progression_level", { ascending: true })
    .limit(1);

  const next = candidates?.[0];
  return next ? { slug: next.slug, title: next.title, difficulty: next.difficulty } : null;
}
