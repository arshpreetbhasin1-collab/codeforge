import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectCoachContext } from "@/lib/ai/context";
import { masteryLevelForScore } from "@/lib/mastery/weights";
import { MISTAKE_CATEGORY_LABEL } from "@/lib/mistakes/taxonomy";
import type { MistakeCategory } from "@/types/domain";

/**
 * Assembles the restricted context the AI Project Coach is allowed to
 * see — see AI PROJECT COACH: "must NOT get unrestricted DB access...
 * must NOT reveal hidden tests." Deliberately selects only visible
 * (is_hidden = false) test cases for the failure detail; hidden test
 * inputs/expected outputs are never read here, so there is nothing for
 * the coach to leak even by mistake. Read-only — nothing here mutates
 * project state.
 */
export async function getProjectCoachContext(
  supabase: SupabaseClient,
  userId: string,
  params: { projectId: string; stageId: string; languageSlug: string; sourceCode: string },
): Promise<ProjectCoachContext | null> {
  const { data: project } = await supabase.from("projects").select("title").eq("id", params.projectId).maybeSingle();
  const { data: stage } = await supabase.from("project_stages").select("title, description").eq("id", params.stageId).eq("project_id", params.projectId).maybeSingle();
  if (!project || !stage) return null;

  const { data: visibleTestCases } = await supabase
    .from("project_test_cases")
    .select("id, input, expected_output")
    .eq("stage_id", params.stageId)
    .eq("is_hidden", false)
    .order("sort_order", { ascending: true });

  const { data: latestSubmission } = await supabase
    .from("project_submissions")
    .select("id, passed_test_count, total_test_count")
    .eq("user_id", userId)
    .eq("stage_id", params.stageId)
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let visibleTestSummary: ProjectCoachContext["visibleTestSummary"] = null;
  if (latestSubmission && visibleTestCases && visibleTestCases.length > 0) {
    const visibleIds = new Set(visibleTestCases.map((tc) => tc.id as string));
    const { data: results } = await supabase
      .from("project_test_results")
      .select("test_case_id, passed, actual_output")
      .eq("project_submission_id", latestSubmission.id)
      .in("test_case_id", [...visibleIds]);

    const resultByTestCase = new Map((results ?? []).map((r) => [r.test_case_id as string, r]));
    const failures = visibleTestCases
      .filter((tc) => resultByTestCase.get(tc.id as string)?.passed === false)
      .map((tc) => ({
        input: tc.input as string,
        expectedOutput: tc.expected_output as string,
        actualOutput: (resultByTestCase.get(tc.id as string)?.actual_output as string | null) ?? "",
      }));

    visibleTestSummary = { passedCount: latestSubmission.passed_test_count, totalCount: latestSubmission.total_test_count, failures };
  }

  const { data: demonstratedSkillIds } = await supabase.from("project_skills").select("skill_id").eq("project_id", params.projectId).eq("relationship", "demonstrates");
  const skillIds = (demonstratedSkillIds ?? []).map((r) => r.skill_id as string);

  let relevantMastery: ProjectCoachContext["relevantMastery"] = [];
  if (skillIds.length > 0) {
    const [{ data: masteryRows }, { data: skillRows }] = await Promise.all([
      supabase.from("skill_mastery").select("skill_id, mastery_score").eq("user_id", userId).in("skill_id", skillIds),
      supabase.from("skills").select("id, name").in("id", skillIds),
    ]);
    const nameById = new Map((skillRows ?? []).map((s) => [s.id as string, s.name as string]));
    relevantMastery = (masteryRows ?? []).map((m) => ({
      skillName: nameById.get(m.skill_id as string) ?? "Unknown skill",
      masteryScore: m.mastery_score as number,
      level: masteryLevelForScore(m.mastery_score as number),
    }));
  }

  const { data: mistakeRows } = await supabase
    .from("mistake_events")
    .select("category")
    .eq("user_id", userId)
    .eq("project_id", params.projectId);

  const countByCategory = new Map<MistakeCategory, number>();
  for (const row of mistakeRows ?? []) {
    const category = row.category as MistakeCategory;
    countByCategory.set(category, (countByCategory.get(category) ?? 0) + 1);
  }
  const relevantMistakes = [...countByCategory.entries()].map(([category, occurrenceCount]) => ({
    category,
    label: MISTAKE_CATEGORY_LABEL[category],
    occurrenceCount,
  }));

  return {
    projectTitle: project.title as string,
    currentStage: { title: stage.title as string, description: stage.description as string },
    learnerCode: params.sourceCode.slice(0, 8000),
    languageSlug: params.languageSlug,
    visibleTestSummary,
    relevantMastery,
    relevantMistakes,
    generatedAt: new Date().toISOString(),
  };
}
