import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateProjectReadiness, type ProjectReadiness } from "./get-project-readiness";
import type { ProjectDifficulty, ProjectExample, ProjectScoringWeights, ProjectVerdict } from "@/types/domain";

export interface ProjectDetailRequirement {
  title: string;
  description: string;
}

export interface ProjectDetailStage {
  id: string;
  slug: string;
  title: string;
  description: string;
  sortOrder: number;
  status: "not_started" | "in_progress" | "completed";
}

export interface ProjectDetailSkill {
  skillId: string;
  skillName: string;
  relationship: "prerequisite" | "demonstrates";
  minMasteryScore: number | null;
}

export interface ProjectDetail {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: ProjectDifficulty;
  overview: string;
  problemStatement: string;
  whyItMatters: string;
  objectives: string[];
  constraintsList: string[];
  examples: ProjectExample[];
  starterInstructions: string;
  scoringWeights: ProjectScoringWeights;
  estimatedHours: number | null;
  starterRepoUrl: string | null;
  requirements: ProjectDetailRequirement[];
  stages: ProjectDetailStage[];
  skills: ProjectDetailSkill[];
  languageSlugs: string[];
  readiness: ProjectReadiness | null;
  /** Null when not signed in — never fabricated. */
  progressVerdict: ProjectVerdict | null;
  bestScore: number | null;
}

/**
 * Everything the project brief page needs — see PROJECT BRIEF. Hidden
 * project_test_cases are deliberately never selected here (mirrors
 * getProblemDetail's discipline exactly): the brief shows objectives,
 * requirements, stage titles, and visible examples only, never test
 * inputs/outputs.
 */
export async function getProjectDetail(supabase: SupabaseClient, userId: string | null, slug: string): Promise<ProjectDetail | null> {
  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, slug, title, description, difficulty, overview, problem_statement, why_it_matters, objectives, constraints_list, examples, starter_instructions, scoring_weights, estimated_hours, starter_repo_url",
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (!project) return null;

  const [{ data: requirementRows }, { data: stageRows }, { data: skillRows }, { data: languageRows }, { data: progressRow }] = await Promise.all([
    supabase.from("project_requirements").select("title, description").eq("project_id", project.id).order("sort_order", { ascending: true }),
    supabase.from("project_stages").select("id, slug, title, description, sort_order").eq("project_id", project.id).order("sort_order", { ascending: true }),
    supabase.from("project_skills").select("skill_id, relationship, min_mastery_score, skills(name)").eq("project_id", project.id),
    supabase.from("project_languages").select("languages(slug)").eq("project_id", project.id),
    userId
      ? supabase.from("user_project_progress").select("verdict, best_score, current_stage_id").eq("user_id", userId).eq("project_id", project.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const stageStatusById = new Map<string, "not_started" | "in_progress" | "completed">();
  if (userId && (stageRows ?? []).length > 0) {
    const { data: stageProgressRows } = await supabase
      .from("project_stage_progress")
      .select("stage_id, status")
      .eq("user_id", userId)
      .in(
        "stage_id",
        (stageRows ?? []).map((s) => s.id as string),
      );
    for (const row of stageProgressRows ?? []) {
      stageStatusById.set(row.stage_id as string, row.status as "not_started" | "in_progress" | "completed");
    }
  }

  type SkillRow = { skill_id: string; relationship: "prerequisite" | "demonstrates"; min_mastery_score: number | null; skills: { name: string } | null };
  type LanguageRow = { languages: { slug: string } | null };

  const readiness = userId ? await calculateProjectReadiness(supabase, userId, project.id) : null;

  return {
    id: project.id,
    slug: project.slug,
    title: project.title,
    description: project.description,
    difficulty: project.difficulty,
    overview: project.overview,
    problemStatement: project.problem_statement,
    whyItMatters: project.why_it_matters,
    objectives: (project.objectives as string[] | null) ?? [],
    constraintsList: (project.constraints_list as string[] | null) ?? [],
    examples: (project.examples as ProjectExample[] | null) ?? [],
    starterInstructions: project.starter_instructions,
    scoringWeights: project.scoring_weights as ProjectScoringWeights,
    estimatedHours: project.estimated_hours,
    starterRepoUrl: project.starter_repo_url,
    requirements: requirementRows ?? [],
    stages: (stageRows ?? []).map((row) => ({
      id: row.id as string,
      slug: row.slug as string,
      title: row.title as string,
      description: row.description as string,
      sortOrder: row.sort_order as number,
      status: stageStatusById.get(row.id as string) ?? "not_started",
    })),
    skills: ((skillRows as unknown as SkillRow[]) ?? [])
      .filter((row) => row.skills)
      .map((row) => ({
        skillId: row.skill_id,
        skillName: row.skills!.name,
        relationship: row.relationship,
        minMasteryScore: row.min_mastery_score,
      })),
    languageSlugs: ((languageRows as unknown as LanguageRow[]) ?? []).filter((row) => row.languages).map((row) => row.languages!.slug),
    readiness,
    progressVerdict: progressRow ? (progressRow.verdict as ProjectVerdict) : userId ? "not_started" : null,
    bestScore: progressRow?.best_score ?? null,
  };
}
