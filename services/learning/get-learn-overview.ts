import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface LearnOverviewLesson {
  id: string;
  slug: string;
  title: string;
  sortOrder: number;
  estimatedMinutes: number;
  status: "not_started" | "in_progress" | "completed";
}

export interface LearnOverviewModule {
  id: string;
  slug: string;
  title: string;
  description: string;
  sortOrder: number;
  difficulty: number;
  estimatedMinutes: number;
  lessons: LearnOverviewLesson[];
}

export interface LearnOverview {
  curriculum: { id: string; slug: string; title: string; description: string } | null;
  modules: LearnOverviewModule[];
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
  /** First not-yet-completed lesson, in curriculum order — see LEARNING PATH. */
  nextLesson: { moduleSlug: string; lessonSlug: string; title: string } | null;
}

const EMPTY_OVERVIEW: LearnOverview = {
  curriculum: null,
  modules: [],
  totalLessons: 0,
  completedLessons: 0,
  progressPercent: 0,
  nextLesson: null,
};

/**
 * The curriculum tree + this student's completion state, flattened into
 * what /learn (and the "Continue learning" dashboard CTA) render. Uses
 * module/lesson sort_order as the recommendation signal for now — see
 * LEARNING PATH: "recommendation should initially use prerequisite/order
 * logic," Prompt 4 replaces this with the adaptive skill-graph version.
 */
export async function getLearnOverview(
  supabase: SupabaseClient,
  userId: string | null,
  languageSlug = "python",
): Promise<LearnOverview> {
  try {
    const { data: language } = await supabase
      .from("languages")
      .select("id")
      .eq("slug", languageSlug)
      .maybeSingle();

    if (!language) return EMPTY_OVERVIEW;

    const { data: curriculum } = await supabase
      .from("curricula")
      .select("id, slug, title, description")
      .eq("language_id", language.id)
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!curriculum) return EMPTY_OVERVIEW;

    const { data: moduleRows } = await supabase
      .from("modules")
      .select("id, slug, title, description, sort_order, difficulty, estimated_minutes")
      .eq("curriculum_id", curriculum.id)
      .order("sort_order", { ascending: true });

    if (!moduleRows || moduleRows.length === 0) {
      return { ...EMPTY_OVERVIEW, curriculum };
    }

    const moduleIds = moduleRows.map((m) => m.id);
    const { data: lessonRows } = await supabase
      .from("lessons")
      .select("id, module_id, slug, title, sort_order, estimated_minutes")
      .in("module_id", moduleIds)
      .eq("is_published", true)
      .order("sort_order", { ascending: true });

    const progressByLessonId = new Map<string, "in_progress" | "completed">();
    if (userId && lessonRows && lessonRows.length > 0) {
      const { data: progressRows } = await supabase
        .from("user_lesson_progress")
        .select("lesson_id, status")
        .eq("user_id", userId)
        .in(
          "lesson_id",
          lessonRows.map((l) => l.id),
        );
      for (const row of progressRows ?? []) {
        progressByLessonId.set(row.lesson_id, row.status);
      }
    }

    const modules: LearnOverviewModule[] = moduleRows.map((m) => ({
      id: m.id,
      slug: m.slug,
      title: m.title,
      description: m.description,
      sortOrder: m.sort_order,
      difficulty: m.difficulty,
      estimatedMinutes: m.estimated_minutes,
      lessons: (lessonRows ?? [])
        .filter((l) => l.module_id === m.id)
        .map((l) => ({
          id: l.id,
          slug: l.slug,
          title: l.title,
          sortOrder: l.sort_order,
          estimatedMinutes: l.estimated_minutes,
          status: progressByLessonId.get(l.id) ?? "not_started",
        })),
    }));

    const allLessons = modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleSlug: m.slug })));
    const completedLessons = allLessons.filter((l) => l.status === "completed").length;
    const totalLessons = allLessons.length;
    const firstIncomplete = allLessons.find((l) => l.status !== "completed");

    return {
      curriculum,
      modules,
      totalLessons,
      completedLessons,
      progressPercent: totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100),
      nextLesson: firstIncomplete
        ? { moduleSlug: firstIncomplete.moduleSlug, lessonSlug: firstIncomplete.slug, title: firstIncomplete.title }
        : null,
    };
  } catch {
    // Supabase not configured yet — see README "Environment variables".
    return EMPTY_OVERVIEW;
  }
}
