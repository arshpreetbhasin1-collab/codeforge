import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeProjectReadiness, type ProjectSkillRequirement, type MissingProjectSkill } from "@/lib/projects/readiness";
import type { ProjectVerdict } from "@/types/domain";

export type { MissingProjectSkill };

export interface ProjectReadiness {
  projectId: string;
  projectSlug: string;
  projectTitle: string;
  readinessScore: number;
  isReady: boolean;
  missingSkills: MissingProjectSkill[];
  explanation: string;
  /** This learner's actual progress on the project, if any — never fabricated. */
  progressVerdict: ProjectVerdict;
}

interface ProjectSkillRow {
  project_id: string;
  skill_id: string;
  min_mastery_score: number | null;
}

/**
 * Reuses project_skills (relationship='prerequisite') — see
 * db/schema/020_project_engine.sql. Supersedes reading
 * projects.required_skills jsonb (008_projects.sql), which is left in
 * place but now unread — see ABSOLUTE RULES: "extend, never duplicate."
 * The actual scoring math lives in lib/projects/readiness.ts (pure, unit-
 * tested); this function only maps real Supabase rows into its inputs —
 * see MASTERY MODEL's lib/ vs services/ split, applied the same way here.
 */
export async function getProjectReadiness(supabase: SupabaseClient, userId: string): Promise<ProjectReadiness[]> {
  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, slug, title")
    .eq("is_published", true);

  if (projectsError) {
    throw new Error(`Failed to load projects: ${projectsError.message}`);
  }
  if (!projects || projects.length === 0) return [];

  return getProjectReadinessForProjects(supabase, userId, projects as { id: string; slug: string; title: string }[]);
}

/**
 * Same computation as getProjectReadiness(), but scoped to an already-
 * fetched, already-filtered/paginated set of projects — see PERFORMANCE:
 * "never fetch all project submissions on every page load." Used by the
 * catalog (services/projects/get-project-catalog.ts) so readiness is only
 * computed for the page actually being rendered, not every published
 * project.
 */
export async function getProjectReadinessForProjects(
  supabase: SupabaseClient,
  userId: string,
  projects: { id: string; slug: string; title: string }[],
): Promise<ProjectReadiness[]> {
  if (projects.length === 0) return [];

  const projectIds = projects.map((p) => p.id);

  const { data: requirementRows, error: requirementsError } = await supabase
    .from("project_skills")
    .select("project_id, skill_id, min_mastery_score")
    .in("project_id", projectIds)
    .eq("relationship", "prerequisite");

  if (requirementsError) {
    throw new Error(`Failed to load project skill requirements: ${requirementsError.message}`);
  }

  const requirementRowsTyped = (requirementRows ?? []) as ProjectSkillRow[];
  const requirementsByProject = new Map<string, ProjectSkillRow[]>();
  for (const row of requirementRowsTyped) {
    const list = requirementsByProject.get(row.project_id) ?? [];
    list.push(row);
    requirementsByProject.set(row.project_id, list);
  }

  const allSkillIds = [...new Set(requirementRowsTyped.map((r) => r.skill_id))];

  const [{ data: masteryRows }, { data: skillRows }, { data: progressRows }] = await Promise.all([
    allSkillIds.length > 0
      ? supabase.from("skill_mastery").select("skill_id, mastery_score").eq("user_id", userId).in("skill_id", allSkillIds)
      : Promise.resolve({ data: [] as { skill_id: string; mastery_score: number }[] }),
    allSkillIds.length > 0 ? supabase.from("skills").select("id, name").in("id", allSkillIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    supabase.from("user_project_progress").select("project_id, verdict").eq("user_id", userId).in("project_id", projectIds),
  ]);

  const masteryBySkill = new Map((masteryRows ?? []).map((r) => [r.skill_id as string, r.mastery_score as number]));
  const nameBySkill = new Map((skillRows ?? []).map((r) => [r.id as string, r.name as string]));
  const verdictByProject = new Map((progressRows ?? []).map((r) => [r.project_id as string, r.verdict as ProjectVerdict]));

  return projects.map((project) => {
    const required = requirementsByProject.get(project.id as string) ?? [];
    const progressVerdict = verdictByProject.get(project.id as string) ?? "not_started";

    const requirements: ProjectSkillRequirement[] = required.map((r) => ({
      skillId: r.skill_id,
      skillName: nameBySkill.get(r.skill_id) ?? "Unknown skill",
      minMasteryScore: r.min_mastery_score ?? 0,
    }));

    const result = computeProjectReadiness(requirements, masteryBySkill);

    return {
      projectId: project.id as string,
      projectSlug: project.slug as string,
      projectTitle: project.title as string,
      readinessScore: result.readinessScore,
      isReady: result.isReady,
      missingSkills: result.missingSkills,
      explanation: result.explanation,
      progressVerdict,
    };
  });
}

/**
 * Single-project readiness — see PHASE 16's requested
 * calculateProjectReadiness(userId, projectId) signature. Reuses
 * getProjectReadiness() rather than duplicating the scoring logic; null
 * means the project doesn't exist or isn't published (never fabricated
 * as "not ready" — see DATA INTEGRITY).
 */
export async function calculateProjectReadiness(supabase: SupabaseClient, userId: string, projectId: string): Promise<ProjectReadiness | null> {
  const all = await getProjectReadiness(supabase, userId);
  return all.find((p) => p.projectId === projectId) ?? null;
}
