import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface SearchResult {
  kind: "lesson" | "skill" | "problem";
  title: string;
  description: string;
  href: string;
}

const RESULT_LIMIT = 5;

/**
 * Database-backed search across lessons, skills, and problems — see
 * SEARCH: never load the whole content set into the browser to filter
 * client-side.
 */
export async function searchContent(supabase: SupabaseClient, query: string): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const pattern = `%${trimmed}%`;

  const [{ data: lessons }, { data: skills }, { data: problems }] = await Promise.all([
    supabase
      .from("lessons")
      .select("title, why, slug, modules(slug)")
      .eq("is_published", true)
      .ilike("title", pattern)
      .limit(RESULT_LIMIT),
    supabase.from("skills").select("name, description, slug").ilike("name", pattern).limit(RESULT_LIMIT),
    supabase
      .from("problems")
      .select("title, learning_objective, slug")
      .eq("is_published", true)
      .ilike("title", pattern)
      .limit(RESULT_LIMIT),
  ]);

  type LessonRow = { title: string; why: string; slug: string; modules: { slug: string } | null };

  const results: SearchResult[] = [];

  for (const row of (lessons as unknown as LessonRow[]) ?? []) {
    if (!row.modules) continue;
    results.push({
      kind: "lesson",
      title: row.title,
      description: row.why,
      href: `/learn/${row.modules.slug}/${row.slug}`,
    });
  }

  for (const row of skills ?? []) {
    results.push({
      kind: "skill",
      title: row.name,
      description: row.description,
      href: `/practice?skill=${row.slug}`,
    });
  }

  for (const row of problems ?? []) {
    results.push({
      kind: "problem",
      title: row.title,
      description: row.learning_objective,
      href: `/practice/${row.slug}`,
    });
  }

  return results;
}
