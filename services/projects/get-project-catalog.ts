import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProjectReadinessForProjects } from "./get-project-readiness";
import type { ProjectDifficulty, ProjectVerdict } from "@/types/domain";

export interface ProjectCard {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: ProjectDifficulty;
  estimatedHours: number | null;
  isFeatured: boolean;
  languageSlugs: string[];
  readinessScore: number;
  isReady: boolean;
  explanation: string;
  progressVerdict: ProjectVerdict;
}

export interface ProjectCatalogFilters {
  difficulty?: ProjectDifficulty;
  languageSlug?: string;
  query?: string;
}

export type ProjectCatalogSort = "recommended" | "newest" | "difficulty";

export interface ProjectCatalogPage {
  projects: ProjectCard[];
  totalCount: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 20;

interface ProjectRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: ProjectDifficulty;
  estimated_hours: number | null;
  is_featured: boolean;
  created_at: string;
}

/**
 * Server-filtered, paginated project list — see PERFORMANCE: never send
 * the full project catalog to the client to filter in React. Difficulty
 * and search apply at the query level; the language filter applies after
 * (project_languages is a join table, cheap to intersect against an
 * already-small filtered/paginated page rather than a second query
 * parameter on `projects` itself).
 */
export async function getProjectCatalog(
  supabase: SupabaseClient,
  userId: string,
  filters: ProjectCatalogFilters,
  sort: ProjectCatalogSort = "recommended",
  page = 1,
): Promise<ProjectCatalogPage> {
  let query = supabase
    .from("projects")
    .select("id, slug, title, description, difficulty, estimated_hours, is_featured, created_at", { count: "exact" })
    .eq("is_published", true);

  if (filters.difficulty) query = query.eq("difficulty", filters.difficulty);
  if (filters.query) query = query.ilike("title", `%${filters.query}%`);

  if (filters.languageSlug) {
    const { data: language } = await supabase.from("languages").select("id").eq("slug", filters.languageSlug).maybeSingle();
    if (!language) return { projects: [], totalCount: 0, page, pageSize: PAGE_SIZE };
    const { data: links } = await supabase.from("project_languages").select("project_id").eq("language_id", language.id);
    const projectIds = (links ?? []).map((l) => l.project_id as string);
    if (projectIds.length === 0) return { projects: [], totalCount: 0, page, pageSize: PAGE_SIZE };
    query = query.in("id", projectIds);
  }

  if (sort === "difficulty") {
    query = query.order("difficulty", { ascending: true }).order("title", { ascending: true });
  } else {
    // "recommended" ranks by readiness after hydration below; fetch newest-first as a stable base order.
    query = query.order("created_at", { ascending: false });
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data: rows, count, error } = await query.range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error(`Failed to load projects: ${error.message}`);

  const projects = await hydrateProjectCards(supabase, userId, (rows ?? []) as ProjectRow[]);

  const sorted = sort === "recommended" ? [...projects].sort((a, b) => b.readinessScore - a.readinessScore) : projects;

  return { projects: sorted, totalCount: count ?? 0, page, pageSize: PAGE_SIZE };
}

export interface ProjectCatalogSections {
  featured: ProjectCard[];
  /** Ready or near-ready (readinessScore >= 0.7), not yet passed. */
  recommended: ProjectCard[];
  inProgress: ProjectCard[];
  completed: ProjectCard[];
  /** Every published project, newest first — the landing page's fallback when every curated section above is empty but real projects exist. */
  all: ProjectCard[];
}

/** The /projects landing sections — see CATALOG: "Featured/Recommended/... Completed/In Progress." */
export async function getProjectCatalogSections(supabase: SupabaseClient, userId: string): Promise<ProjectCatalogSections> {
  const { data: rows, error } = await supabase
    .from("projects")
    .select("id, slug, title, description, difficulty, estimated_hours, is_featured, created_at")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load projects: ${error.message}`);

  const projects = await hydrateProjectCards(supabase, userId, (rows ?? []) as ProjectRow[]);

  const featured = projects.filter((p) => p.isFeatured);
  const inProgress = projects.filter((p) => p.progressVerdict === "in_progress");
  const completed = projects.filter((p) => p.progressVerdict === "passed");
  const recommended = projects
    .filter((p) => p.progressVerdict !== "passed" && p.progressVerdict !== "in_progress" && p.readinessScore >= 0.7)
    .sort((a, b) => b.readinessScore - a.readinessScore);

  return { featured, recommended, inProgress, completed, all: projects };
}

async function hydrateProjectCards(supabase: SupabaseClient, userId: string, rows: ProjectRow[]): Promise<ProjectCard[]> {
  if (rows.length === 0) return [];

  const [readiness, languagesBySlug] = await Promise.all([
    getProjectReadinessForProjects(supabase, userId, rows),
    getLanguageSlugsByProject(supabase, rows.map((r) => r.id)),
  ]);

  const readinessById = new Map(readiness.map((r) => [r.projectId, r]));

  return rows.map((row) => {
    const r = readinessById.get(row.id);
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      difficulty: row.difficulty,
      estimatedHours: row.estimated_hours,
      isFeatured: row.is_featured,
      languageSlugs: languagesBySlug.get(row.id) ?? [],
      readinessScore: r?.readinessScore ?? 1,
      isReady: r?.isReady ?? true,
      explanation: r?.explanation ?? "No prerequisite skills required — you're ready to start.",
      progressVerdict: r?.progressVerdict ?? "not_started",
    };
  });
}

async function getLanguageSlugsByProject(supabase: SupabaseClient, projectIds: string[]): Promise<Map<string, string[]>> {
  if (projectIds.length === 0) return new Map();

  const { data } = await supabase.from("project_languages").select("project_id, languages(slug)").in("project_id", projectIds);

  type Row = { project_id: string; languages: { slug: string } | null };
  const result = new Map<string, string[]>();
  for (const row of (data as unknown as Row[]) ?? []) {
    if (!row.languages) continue;
    const list = result.get(row.project_id) ?? [];
    list.push(row.languages.slug);
    result.set(row.project_id, list);
  }
  return result;
}
