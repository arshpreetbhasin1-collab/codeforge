import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectVerdict } from "@/types/domain";

export interface WorkspaceStage {
  id: string;
  slug: string;
  title: string;
  description: string;
  sortOrder: number;
  status: "not_started" | "in_progress" | "completed";
  /** A learner can only work in a stage they've reached — never a future, still-locked one. */
  isReachable: boolean;
}

export interface WorkspaceStageRequirement {
  description: string;
}

export interface WorkspaceSubmissionSummary {
  id: string;
  attemptNumber: number;
  verdict: ProjectVerdict | null;
  score: number | null;
  passedTestCount: number;
  totalTestCount: number;
  submittedAt: string | null;
}

export interface ProjectWorkspaceData {
  /** The viewer's own id — echoed back only to scope the client-side draft cache key per-user (see project-workspace-view.tsx's draftKey()), never used for authorization. */
  userId: string;
  projectId: string;
  projectSlug: string;
  projectTitle: string;
  overallVerdict: ProjectVerdict;
  bestScore: number | null;
  languageSlugs: string[];
  stages: WorkspaceStage[];
  currentStage: WorkspaceStage;
  currentStageRequirements: WorkspaceStageRequirement[];
  recentSubmissions: WorkspaceSubmissionSummary[];
}

/**
 * Everything the three-panel workspace needs for one visit — see
 * WORKSPACE. Hidden project_test_cases are never selected here, same
 * discipline as the brief page. Only a project the learner has actually
 * started (a real user_project_progress row) can be opened — see
 * SECURITY: never trust a client-supplied "I'm allowed here."
 */
export async function getProjectWorkspaceData(
  supabase: SupabaseClient,
  userId: string,
  slug: string,
  requestedStageSlug: string | null,
): Promise<ProjectWorkspaceData | null> {
  const { data: project } = await supabase.from("projects").select("id, slug, title").eq("slug", slug).eq("is_published", true).maybeSingle();
  if (!project) return null;

  const { data: progress } = await supabase
    .from("user_project_progress")
    .select("verdict, best_score, current_stage_id")
    .eq("user_id", userId)
    .eq("project_id", project.id)
    .maybeSingle();
  if (!progress) return null;

  const [{ data: stageRows }, { data: languageRows }] = await Promise.all([
    supabase.from("project_stages").select("id, slug, title, description, sort_order").eq("project_id", project.id).order("sort_order", { ascending: true }),
    supabase.from("project_languages").select("languages(slug)").eq("project_id", project.id),
  ]);

  const orderedStages = stageRows ?? [];
  if (orderedStages.length === 0) return null;

  const { data: stageProgressRows } = await supabase
    .from("project_stage_progress")
    .select("stage_id, status")
    .eq("user_id", userId)
    .in(
      "stage_id",
      orderedStages.map((s) => s.id as string),
    );
  const statusByStage = new Map((stageProgressRows ?? []).map((r) => [r.stage_id as string, r.status as "not_started" | "in_progress" | "completed"]));

  const currentStageIndex = progress.current_stage_id ? orderedStages.findIndex((s) => s.id === progress.current_stage_id) : 0;
  const reachableIndex = currentStageIndex === -1 ? 0 : currentStageIndex;

  const stages: WorkspaceStage[] = orderedStages.map((row, i) => ({
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    description: row.description as string,
    sortOrder: row.sort_order as number,
    status: statusByStage.get(row.id as string) ?? "not_started",
    isReachable: i <= reachableIndex,
  }));

  const requestedStage = requestedStageSlug ? stages.find((s) => s.slug === requestedStageSlug && s.isReachable) : null;
  const currentStage = requestedStage ?? stages[reachableIndex] ?? stages[0];

  const { data: requirementRows } = await supabase.from("project_stage_requirements").select("description").eq("stage_id", currentStage.id).order("sort_order", { ascending: true });

  const { data: submissionRows } = await supabase
    .from("project_submissions")
    .select("id, attempt_number, verdict, score, passed_test_count, total_test_count, submitted_at")
    .eq("user_id", userId)
    .eq("stage_id", currentStage.id)
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(10);

  type LanguageRow = { languages: { slug: string } | null };

  return {
    userId,
    projectId: project.id as string,
    projectSlug: project.slug as string,
    projectTitle: project.title as string,
    overallVerdict: progress.verdict as ProjectVerdict,
    bestScore: progress.best_score,
    languageSlugs: ((languageRows as unknown as LanguageRow[]) ?? []).filter((r) => r.languages).map((r) => r.languages!.slug),
    stages,
    currentStage,
    currentStageRequirements: requirementRows ?? [],
    recentSubmissions: (submissionRows ?? []).map((row) => ({
      id: row.id as string,
      attemptNumber: row.attempt_number as number,
      verdict: row.verdict as ProjectVerdict | null,
      score: row.score as number | null,
      passedTestCount: row.passed_test_count as number,
      totalTestCount: row.total_test_count as number,
      submittedAt: row.submitted_at as string | null,
    })),
  };
}
