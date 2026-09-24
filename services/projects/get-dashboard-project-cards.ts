import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProjectReadiness } from "./get-project-readiness";

export interface CurrentProjectCard {
  projectSlug: string;
  projectTitle: string;
  currentStageTitle: string | null;
  completedStages: number;
  totalStages: number;
  percentComplete: number;
}

export interface RecommendedProjectCard {
  projectSlug: string;
  projectTitle: string;
  readinessScore: number;
  estimatedHours: number | null;
  /** Real, specific reasoning from the readiness engine — never fabricated. */
  explanation: string;
}

export interface DashboardProjectCards {
  current: CurrentProjectCard | null;
  recommended: RecommendedProjectCard | null;
}

/**
 * What the dashboard's "Current Project" / "Recommended Project" cards
 * read — see DASHBOARD INTEGRATION. Both built from real progress/
 * readiness data; a project only appears as "recommended" if it's
 * genuinely ready or close (readinessScore >= 0.7) and the learner hasn't
 * already started it — never a fabricated suggestion.
 */
export async function getDashboardProjectCards(supabase: SupabaseClient, userId: string): Promise<DashboardProjectCards> {
  const { data: inProgressRow } = await supabase
    .from("user_project_progress")
    .select("project_id, current_stage_id, projects(slug, title)")
    .eq("user_id", userId)
    .eq("verdict", "in_progress")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let current: CurrentProjectCard | null = null;
  if (inProgressRow) {
    type ProjectRow = { slug: string; title: string } | null;
    const project = inProgressRow.projects as unknown as ProjectRow;

    const [{ data: stages }, { data: stageProgress }] = await Promise.all([
      supabase.from("project_stages").select("id, title").eq("project_id", inProgressRow.project_id).order("sort_order", { ascending: true }),
      supabase.from("project_stage_progress").select("stage_id, status").eq("user_id", userId).eq("project_id", inProgressRow.project_id),
    ]);

    const totalStages = stages?.length ?? 0;
    const completedStages = (stageProgress ?? []).filter((s) => s.status === "completed").length;
    const currentStageTitle = (stages ?? []).find((s) => s.id === inProgressRow.current_stage_id)?.title ?? null;

    if (project) {
      current = {
        projectSlug: project.slug,
        projectTitle: project.title,
        currentStageTitle,
        completedStages,
        totalStages,
        percentComplete: totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0,
      };
    }
  }

  const readiness = await getProjectReadiness(supabase, userId);
  const recommendedCandidate = readiness
    .filter((p) => p.progressVerdict === "not_started" && p.readinessScore >= 0.7)
    .sort((a, b) => b.readinessScore - a.readinessScore)[0];

  let recommended: RecommendedProjectCard | null = null;
  if (recommendedCandidate) {
    const { data: projectRow } = await supabase.from("projects").select("estimated_hours").eq("id", recommendedCandidate.projectId).maybeSingle();
    recommended = {
      projectSlug: recommendedCandidate.projectSlug,
      projectTitle: recommendedCandidate.projectTitle,
      readinessScore: recommendedCandidate.readinessScore,
      estimatedHours: projectRow?.estimated_hours ?? null,
      explanation: recommendedCandidate.explanation,
    };
  }

  return { current, recommended };
}
