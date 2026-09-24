import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectScoreBreakdown, ProjectVerdict } from "@/types/domain";

export interface ProjectReviewDetail {
  id: string;
  projectTitle: string;
  projectSlug: string;
  stageTitle: string | null;
  overallScore: number;
  scoreBreakdown: ProjectScoreBreakdown;
  verdict: ProjectVerdict;
  strengths: string[];
  weaknesses: string[];
  complexityAssessment: string | null;
  testingAssessment: string | null;
  nextRecommendedAction: string | null;
  /** Clearly-labeled AI commentary — null when no AI provider was configured at review time. Never mixed into the deterministic fields above. */
  aiSummary: string | null;
  reviewedAt: string;
}

/**
 * A single project_reviews row, scoped to its owner — see PROJECT REVIEW.
 * RLS already enforces ownership, but this also explicitly filters by
 * userId so a cross-user id guess returns null (never another learner's
 * review, even via a raw id in the URL) rather than relying on RLS alone.
 */
export async function getProjectReview(supabase: SupabaseClient, userId: string, reviewId: string): Promise<ProjectReviewDetail | null> {
  const { data: review } = await supabase
    .from("project_reviews")
    .select("id, overall_score, score_breakdown, verdict, strengths, weaknesses, complexity_assessment, testing_assessment, next_recommended_action, ai_summary, reviewed_at, project_id, project_submission_id")
    .eq("id", reviewId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!review) return null;

  const [{ data: project }, { data: submission }] = await Promise.all([
    supabase.from("projects").select("title, slug").eq("id", review.project_id).maybeSingle(),
    supabase.from("project_submissions").select("stage_id").eq("id", review.project_submission_id).maybeSingle(),
  ]);
  if (!project) return null;

  let stageTitle: string | null = null;
  if (submission?.stage_id) {
    const { data: stage } = await supabase.from("project_stages").select("title").eq("id", submission.stage_id).maybeSingle();
    stageTitle = stage?.title ?? null;
  }

  return {
    id: review.id,
    projectTitle: project.title as string,
    projectSlug: project.slug as string,
    stageTitle,
    overallScore: review.overall_score,
    scoreBreakdown: review.score_breakdown as ProjectScoreBreakdown,
    verdict: review.verdict as ProjectVerdict,
    strengths: (review.strengths as string[] | null) ?? [],
    weaknesses: (review.weaknesses as string[] | null) ?? [],
    complexityAssessment: review.complexity_assessment,
    testingAssessment: review.testing_assessment,
    nextRecommendedAction: review.next_recommended_action,
    aiSummary: review.ai_summary,
    reviewedAt: review.reviewed_at,
  };
}
