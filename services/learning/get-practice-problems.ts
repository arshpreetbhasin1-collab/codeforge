import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProblemDifficulty, ProblemKind } from "@/types/domain";

export interface ProblemSummary {
  id: string;
  slug: string;
  title: string;
  difficulty: ProblemDifficulty;
  problemType: ProblemKind;
  progressionLevel: number;
  skillNames: string[];
  status: "not_started" | "attempted" | "completed";
}

export interface PracticeFilters {
  skillSlug?: string;
  difficulty?: ProblemDifficulty;
  problemType?: ProblemKind;
  completionStatus?: "not_started" | "attempted" | "completed";
  query?: string;
}

export interface PracticeProblemsPage {
  problems: ProblemSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 20;

/**
 * Server-filtered, paginated problem list — see PERFORMANCE: never send
 * the full problem bank to the client. Filters are applied at the query
 * level, not by fetching everything and filtering in React.
 */
export async function getPracticeProblems(
  supabase: SupabaseClient,
  userId: string | null,
  filters: PracticeFilters,
  page = 1,
): Promise<PracticeProblemsPage> {
  let problemIdsForSkill: string[] | null = null;
  if (filters.skillSlug) {
    const { data: skill } = await supabase.from("skills").select("id").eq("slug", filters.skillSlug).maybeSingle();
    if (!skill) return { problems: [], totalCount: 0, page, pageSize: PAGE_SIZE };
    const { data: links } = await supabase
      .from("problem_skills")
      .select("problem_id")
      .eq("skill_id", skill.id)
      .eq("relationship", "teaches");
    problemIdsForSkill = (links ?? []).map((l) => l.problem_id);
    if (problemIdsForSkill.length === 0) return { problems: [], totalCount: 0, page, pageSize: PAGE_SIZE };
  }

  let query = supabase
    .from("problems")
    .select("id, slug, title, difficulty, problem_type, progression_level", { count: "exact" })
    .eq("is_published", true);

  if (problemIdsForSkill) query = query.in("id", problemIdsForSkill);
  if (filters.difficulty) query = query.eq("difficulty", filters.difficulty);
  if (filters.problemType) query = query.eq("problem_type", filters.problemType);
  if (filters.query) query = query.ilike("title", `%${filters.query}%`);

  const from = (page - 1) * PAGE_SIZE;
  const { data: problemRows, count } = await query
    .order("progression_level", { ascending: true })
    .order("title", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  const problems = await hydrateProblemSummaries(supabase, userId, problemRows ?? []);

  const filtered = filters.completionStatus
    ? problems.filter((p) => p.status === filters.completionStatus)
    : problems;

  return { problems: filtered, totalCount: count ?? 0, page, pageSize: PAGE_SIZE };
}

export interface PracticeSections {
  continuePractice: ProblemSummary[];
  recommended: ProblemSummary[];
  recentlyAttempted: ProblemSummary[];
}

/**
 * The /practice landing sections — "what should I solve next," not a grid
 * of everything. Recommended is naive (unattempted, easiest first) until
 * Prompt 4's adaptive engine replaces it.
 */
export async function getPracticeSections(
  supabase: SupabaseClient,
  userId: string | null,
): Promise<PracticeSections> {
  if (!userId) {
    const recommended = await getPracticeProblems(supabase, null, {}, 1);
    return { continuePractice: [], recommended: recommended.problems.slice(0, 5), recentlyAttempted: [] };
  }

  const { data: progressRows } = await supabase
    .from("user_problem_progress")
    .select("problem_id, status")
    .eq("user_id", userId);

  const attemptedIds = (progressRows ?? []).filter((r) => r.status === "attempted").map((r) => r.problem_id);
  const completedIds = new Set((progressRows ?? []).filter((r) => r.status === "completed").map((r) => r.problem_id));
  const attemptedOrCompletedIds = new Set([...attemptedIds, ...completedIds]);

  const [continuePractice, allProblems] = await Promise.all([
    attemptedIds.length > 0 ? loadProblemsByIds(supabase, userId, attemptedIds.slice(0, 5)) : [],
    supabase
      .from("problems")
      .select("id, slug, title, difficulty, problem_type, progression_level")
      .eq("is_published", true)
      .order("progression_level", { ascending: true })
      .order("title", { ascending: true }),
  ]);

  const unattempted = (allProblems.data ?? []).filter((p) => !attemptedOrCompletedIds.has(p.id)).slice(0, 5);
  const recommended = await hydrateProblemSummaries(supabase, userId, unattempted);

  return {
    continuePractice,
    recommended,
    recentlyAttempted: continuePractice,
  };
}

async function loadProblemsByIds(
  supabase: SupabaseClient,
  userId: string | null,
  ids: string[],
): Promise<ProblemSummary[]> {
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("problems")
    .select("id, slug, title, difficulty, problem_type, progression_level")
    .in("id", ids);
  return hydrateProblemSummaries(supabase, userId, data ?? []);
}

interface ProblemRow {
  id: string;
  slug: string;
  title: string;
  difficulty: ProblemDifficulty;
  problem_type: ProblemKind;
  progression_level: number;
}

async function hydrateProblemSummaries(
  supabase: SupabaseClient,
  userId: string | null,
  rows: ProblemRow[],
): Promise<ProblemSummary[]> {
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);

  const [{ data: skillLinks }, statusById] = await Promise.all([
    supabase.from("problem_skills").select("problem_id, skills(name)").in("problem_id", ids),
    loadStatusById(supabase, userId, ids),
  ]);

  type SkillLinkRow = { problem_id: string; skills: { name: string } | null };
  const skillNamesByProblemId = new Map<string, string[]>();
  for (const row of (skillLinks as unknown as SkillLinkRow[]) ?? []) {
    if (!row.skills) continue;
    const existing = skillNamesByProblemId.get(row.problem_id) ?? [];
    existing.push(row.skills.name);
    skillNamesByProblemId.set(row.problem_id, existing);
  }

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    difficulty: row.difficulty,
    problemType: row.problem_type,
    progressionLevel: row.progression_level,
    skillNames: skillNamesByProblemId.get(row.id) ?? [],
    status: statusById.get(row.id) ?? "not_started",
  }));
}

async function loadStatusById(
  supabase: SupabaseClient,
  userId: string | null,
  problemIds: string[],
): Promise<Map<string, "attempted" | "completed">> {
  if (!userId) return new Map();
  const { data } = await supabase
    .from("user_problem_progress")
    .select("problem_id, status")
    .eq("user_id", userId)
    .in("problem_id", problemIds);
  return new Map((data ?? []).map((row) => [row.problem_id, row.status]));
}
