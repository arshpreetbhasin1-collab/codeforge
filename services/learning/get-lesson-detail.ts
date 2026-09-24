import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MicroCheckOption, MicroCheckType } from "@/types/domain";

export interface LessonDetailCodeExample {
  languageSlug: string;
  languageName: string;
  code: string;
  explanation: string | null;
}

export interface LessonDetailMicroCheck {
  id: string;
  type: MicroCheckType;
  question: string;
  codeSnippet: string | null;
  options: MicroCheckOption[] | null;
}

export interface LessonDetail {
  id: string;
  slug: string;
  title: string;
  why: string;
  what: string;
  how: string;
  exampleCode: string;
  exampleLanguageSlug: string | null;
  commonMistake: string;
  microChallengePrompt: string;
  learningObjectives: string[];
  keyTakeaways: string[];
  estimatedMinutes: number;
  moduleSlug: string;
  moduleTitle: string;
  codeExamples: LessonDetailCodeExample[];
  microChecks: LessonDetailMicroCheck[];
  nextProblem: { slug: string; title: string; difficulty: string } | null;
  status: "not_started" | "in_progress" | "completed";
  previousLesson: { moduleSlug: string; lessonSlug: string; title: string } | null;
  nextLesson: { moduleSlug: string; lessonSlug: string; title: string } | null;
}

/**
 * Everything a single lesson page needs: content, per-language examples
 * (concept stays fixed, only syntax changes — see LANGUAGE STRATEGY),
 * micro-checks (never the correct answer — that's graded server-side by
 * submitMicroCheckAttempt), this student's status, and prev/next nav.
 */
export async function getLessonDetail(
  supabase: SupabaseClient,
  userId: string | null,
  moduleSlug: string,
  lessonSlug: string,
): Promise<LessonDetail | null> {
  const { data: moduleRow } = await supabase
    .from("modules")
    .select("id, slug, title, curriculum_id, sort_order")
    .eq("slug", moduleSlug)
    .maybeSingle();

  if (!moduleRow) return null;

  const { data: lesson } = await supabase
    .from("lessons")
    .select(
      "id, slug, title, why, what, how, example_code, example_language_id, common_mistake, micro_challenge_prompt, learning_objectives, key_takeaways, estimated_minutes, sort_order, next_problem_id",
    )
    .eq("module_id", moduleRow.id)
    .eq("slug", lessonSlug)
    .eq("is_published", true)
    .maybeSingle();

  if (!lesson) return null;

  const [{ data: exampleLanguage }, { data: codeExampleRows }, { data: microCheckRows }, { data: nextProblem }] =
    await Promise.all([
      lesson.example_language_id
        ? supabase.from("languages").select("slug").eq("id", lesson.example_language_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("lesson_code_examples")
        .select("code, explanation, languages(slug, display_name)")
        .eq("lesson_id", lesson.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("micro_checks")
        .select("id, type, question, code_snippet, options")
        .eq("lesson_id", lesson.id)
        .order("sort_order", { ascending: true }),
      lesson.next_problem_id
        ? supabase.from("problems").select("slug, title, difficulty").eq("id", lesson.next_problem_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  let status: "not_started" | "in_progress" | "completed" = "not_started";
  if (userId) {
    const { data: progress } = await supabase
      .from("user_lesson_progress")
      .select("status")
      .eq("user_id", userId)
      .eq("lesson_id", lesson.id)
      .maybeSingle();
    if (progress) status = progress.status;
  }

  const { previousLesson, nextLesson } = await getAdjacentLessons(
    supabase,
    moduleRow.curriculum_id,
    moduleRow.sort_order,
    lesson.sort_order,
  );

  type CodeExampleRow = {
    code: string;
    explanation: string | null;
    languages: { slug: string; display_name: string } | null;
  };

  return {
    id: lesson.id,
    slug: lesson.slug,
    title: lesson.title,
    why: lesson.why,
    what: lesson.what,
    how: lesson.how,
    exampleCode: lesson.example_code,
    exampleLanguageSlug: exampleLanguage?.slug ?? null,
    commonMistake: lesson.common_mistake,
    microChallengePrompt: lesson.micro_challenge_prompt,
    learningObjectives: lesson.learning_objectives ?? [],
    keyTakeaways: lesson.key_takeaways ?? [],
    estimatedMinutes: lesson.estimated_minutes,
    moduleSlug: moduleRow.slug,
    moduleTitle: moduleRow.title,
    codeExamples: ((codeExampleRows as unknown as CodeExampleRow[]) ?? [])
      .filter((row) => row.languages)
      .map((row) => ({
        languageSlug: row.languages!.slug,
        languageName: row.languages!.display_name,
        code: row.code,
        explanation: row.explanation,
      })),
    microChecks: (microCheckRows ?? []).map((row) => ({
      id: row.id,
      type: row.type,
      question: row.question,
      codeSnippet: row.code_snippet,
      options: row.options,
    })),
    nextProblem: nextProblem
      ? { slug: nextProblem.slug, title: nextProblem.title, difficulty: nextProblem.difficulty }
      : null,
    status,
    previousLesson,
    nextLesson,
  };
}

interface AdjacentLesson {
  moduleSlug: string;
  lessonSlug: string;
  title: string;
}

async function getAdjacentLessons(
  supabase: SupabaseClient,
  curriculumId: string,
  currentModuleSortOrder: number,
  currentLessonSortOrder: number,
): Promise<{ previousLesson: AdjacentLesson | null; nextLesson: AdjacentLesson | null }> {
  const { data: moduleRows } = await supabase
    .from("modules")
    .select("id, slug, sort_order")
    .eq("curriculum_id", curriculumId)
    .order("sort_order", { ascending: true });

  if (!moduleRows || moduleRows.length === 0) {
    return { previousLesson: null, nextLesson: null };
  }

  const { data: lessonRows } = await supabase
    .from("lessons")
    .select("slug, title, module_id, sort_order")
    .in(
      "module_id",
      moduleRows.map((m) => m.id),
    )
    .eq("is_published", true);

  const moduleSlugById = new Map(moduleRows.map((m) => [m.id, m.slug]));
  const moduleSortById = new Map(moduleRows.map((m) => [m.id, m.sort_order]));

  const flattened = (lessonRows ?? [])
    .map((l) => ({
      moduleSlug: moduleSlugById.get(l.module_id)!,
      lessonSlug: l.slug,
      title: l.title,
      moduleSortOrder: moduleSortById.get(l.module_id)!,
      lessonSortOrder: l.sort_order,
    }))
    .sort((a, b) => a.moduleSortOrder - b.moduleSortOrder || a.lessonSortOrder - b.lessonSortOrder);

  const currentIndex = flattened.findIndex(
    (l) => l.moduleSortOrder === currentModuleSortOrder && l.lessonSortOrder === currentLessonSortOrder,
  );

  if (currentIndex === -1) return { previousLesson: null, nextLesson: null };

  const prev = currentIndex > 0 ? flattened[currentIndex - 1] : null;
  const next = currentIndex < flattened.length - 1 ? flattened[currentIndex + 1] : null;

  return {
    previousLesson: prev ? { moduleSlug: prev.moduleSlug, lessonSlug: prev.lessonSlug, title: prev.title } : null,
    nextLesson: next ? { moduleSlug: next.moduleSlug, lessonSlug: next.lessonSlug, title: next.title } : null,
  };
}
