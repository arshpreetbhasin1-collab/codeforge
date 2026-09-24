import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SkillAttemptEvidence } from "@/lib/mastery/types";
import { DIFFICULTY_RANK } from "@/lib/mastery/weights";
import type { ProblemDifficulty, ProjectDifficulty, ProjectVerdict } from "@/types/domain";

/**
 * projects.difficulty mapped onto the same 1-5 rank problems use — see
 * DIFFICULTY_RANK. A project is inherently substantial multi-stage work,
 * so it's anchored a notch above the equivalent problem tier: beginner ~
 * easy, intermediate ~ medium, advanced ~ hard. No project maps to
 * intro(1) or boss(5) — those extremes stay problem-only.
 */
const PROJECT_DIFFICULTY_RANK: Readonly<Record<ProjectDifficulty, 1 | 2 | 3 | 4 | 5>> = {
  beginner: 2,
  intermediate: 3,
  advanced: 4,
};

/**
 * Maps a user's real submission history for one skill into the pure
 * SkillAttemptEvidence[] shape lib/mastery/mastery.ts consumes. This is
 * the only place that translates Supabase rows into mastery evidence —
 * see MASTERY MODEL: "the algorithm must be traceable to real submission
 * data, never invented."
 *
 * Only 'passed'/'failed'/'error'/'timeout' submissions count as evidence
 * — 'queued'/'running' rows are still in flight and carry no signal yet.
 */
export async function getSkillEvidence(
  supabase: SupabaseClient,
  userId: string,
  skillId: string,
): Promise<SkillAttemptEvidence[]> {
  const [problemEvidence, projectEvidence] = await Promise.all([
    getProblemEvidence(supabase, userId, skillId),
    getProjectEvidence(supabase, userId, skillId),
  ]);
  return [...problemEvidence, ...projectEvidence];
}

async function getProblemEvidence(supabase: SupabaseClient, userId: string, skillId: string): Promise<SkillAttemptEvidence[]> {
  const { data: problemLinks, error: problemLinksError } = await supabase
    .from("problem_skills")
    .select("problem_id")
    .eq("skill_id", skillId)
    .eq("relationship", "teaches");

  if (problemLinksError) {
    throw new Error(`Failed to load problems for skill: ${problemLinksError.message}`);
  }

  const problemIds = (problemLinks ?? []).map((row) => row.problem_id as string);
  if (problemIds.length === 0) return [];

  const { data: submissions, error: submissionsError } = await supabase
    .from("submissions")
    .select("id, problem_id, language_id, status, hints_used_count, created_at")
    .eq("user_id", userId)
    .in("problem_id", problemIds)
    .not("status", "in", "(queued,running,cancelled)")
    .order("created_at", { ascending: true });

  if (submissionsError) {
    throw new Error(`Failed to load submissions for skill: ${submissionsError.message}`);
  }
  if (!submissions || submissions.length === 0) return [];

  const uniqueProblemIds = [...new Set(submissions.map((s) => s.problem_id as string))];
  const uniqueLanguageIds = [...new Set(submissions.map((s) => s.language_id as string))];

  const [{ data: problems }, { data: languages }] = await Promise.all([
    supabase.from("problems").select("id, difficulty").in("id", uniqueProblemIds),
    supabase.from("languages").select("id, slug").in("id", uniqueLanguageIds),
  ]);

  const difficultyByProblem = new Map((problems ?? []).map((p) => [p.id as string, p.difficulty as ProblemDifficulty]));
  const slugByLanguage = new Map((languages ?? []).map((l) => [l.id as string, l.slug as string]));

  return submissions.map((submission) => {
    const difficulty = difficultyByProblem.get(submission.problem_id as string) ?? "easy";
    return {
      passed: submission.status === "accepted",
      difficulty: DIFFICULTY_RANK[difficulty],
      hintsUsed: submission.hints_used_count ?? 0,
      languageSlug: slugByLanguage.get(submission.language_id as string) ?? "unknown",
      attemptedAt: new Date(submission.created_at as string),
    };
  });
}

/**
 * Project-sourced evidence — see PROJECT -> MASTERY. Every graded
 * project_submissions row for a project that `demonstrates` this skill is
 * one attempt, fed into the exact same recency-weighted formula as
 * problem evidence — see calculateSkillMastery(): a failed/needs-
 * improvement attempt still occupies weight in the average (contributes
 * 0), which is what makes "one project can't jump mastery to 100%" and
 * "diminishing returns" true by construction, with zero project-specific
 * math bolted on.
 */
async function getProjectEvidence(supabase: SupabaseClient, userId: string, skillId: string): Promise<SkillAttemptEvidence[]> {
  const { data: projectLinks, error: projectLinksError } = await supabase
    .from("project_skills")
    .select("project_id")
    .eq("skill_id", skillId)
    .eq("relationship", "demonstrates");

  if (projectLinksError) {
    throw new Error(`Failed to load projects for skill: ${projectLinksError.message}`);
  }

  const projectIds = (projectLinks ?? []).map((row) => row.project_id as string);
  if (projectIds.length === 0) return [];

  const { data: submissions, error: submissionsError } = await supabase
    .from("project_submissions")
    .select("id, project_id, language_id, verdict, submitted_at")
    .eq("user_id", userId)
    .in("project_id", projectIds)
    .not("verdict", "is", null)
    .order("submitted_at", { ascending: true });

  if (submissionsError) {
    throw new Error(`Failed to load project submissions for skill: ${submissionsError.message}`);
  }
  if (!submissions || submissions.length === 0) return [];

  const uniqueProjectIds = [...new Set(submissions.map((s) => s.project_id as string))];
  const uniqueLanguageIds = [...new Set((submissions.map((s) => s.language_id as string | null).filter(Boolean) as string[]))];

  const [{ data: projects }, { data: languages }] = await Promise.all([
    supabase.from("projects").select("id, difficulty").in("id", uniqueProjectIds),
    uniqueLanguageIds.length > 0 ? supabase.from("languages").select("id, slug").in("id", uniqueLanguageIds) : Promise.resolve({ data: [] as { id: string; slug: string }[] }),
  ]);

  const difficultyByProject = new Map((projects ?? []).map((p) => [p.id as string, p.difficulty as ProjectDifficulty]));
  const slugByLanguage = new Map((languages ?? []).map((l) => [l.id as string, l.slug as string]));

  return submissions
    .filter((s) => s.submitted_at)
    .map((submission) => {
      const difficulty = difficultyByProject.get(submission.project_id as string) ?? "beginner";
      return {
        passed: (submission.verdict as ProjectVerdict) === "passed",
        difficulty: PROJECT_DIFFICULTY_RANK[difficulty],
        hintsUsed: 0,
        languageSlug: submission.language_id ? (slugByLanguage.get(submission.language_id as string) ?? "unknown") : "unknown",
        attemptedAt: new Date(submission.submitted_at as string),
      };
    });
}

/** Same evidence, grouped per language — what LANGUAGE TRANSFER detection and the CHALLENGE/TRANSFER split in lib/recommendations compare against. */
export function groupEvidenceByLanguage(evidence: SkillAttemptEvidence[]): Map<string, SkillAttemptEvidence[]> {
  const grouped = new Map<string, SkillAttemptEvidence[]>();
  for (const item of evidence) {
    const existing = grouped.get(item.languageSlug);
    if (existing) existing.push(item);
    else grouped.set(item.languageSlug, [item]);
  }
  return grouped;
}
