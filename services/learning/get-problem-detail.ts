import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProblemDifficulty, ProblemKind } from "@/types/domain";

export interface ProblemDetailExample {
  input: string;
  expectedOutput: string;
  explanation: string | null;
}

export interface ProblemDetailHint {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  content: string;
}

export interface ProblemDetailStarterCode {
  languageSlug: string;
  languageName: string;
  starterCode: string;
}

export interface ProblemDetail {
  id: string;
  slug: string;
  title: string;
  statement: string;
  difficulty: ProblemDifficulty;
  problemType: ProblemKind;
  progressionLevel: number;
  learningObjective: string;
  constraints: string | null;
  expectedTimeComplexity: string | null;
  expectedSpaceComplexity: string | null;
  skillNames: string[];
  examples: ProblemDetailExample[];
  hints: ProblemDetailHint[];
  starterCode: ProblemDetailStarterCode[];
  progressStatus: "not_started" | "attempted" | "completed";
  isExecutable: boolean;
  timeLimitMs: number;
  memoryLimitMb: number;
  /** SQL only — the isolated dataset shown to the learner. See SQL PROBLEM DESIGN. */
  sqlDataset: { schemaSql: string; seedSql: string } | null;
}

/**
 * Everything the problem page needs. Hidden test cases are deliberately
 * never selected here — RLS (db/schema/012_rls.sql) would reject it for a
 * non-staff user anyway, but this query doesn't even ask for them: only
 * visible examples are shown, matching what Prompt 3's evaluator will
 * grade against plus the hidden set the student never sees.
 */
export async function getProblemDetail(
  supabase: SupabaseClient,
  userId: string | null,
  slug: string,
): Promise<ProblemDetail | null> {
  const { data: problem } = await supabase
    .from("problems")
    .select(
      "id, slug, title, statement, difficulty, problem_type, progression_level, learning_objective, constraints, expected_time_complexity, expected_space_complexity, is_executable, time_limit_ms, memory_limit_mb",
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (!problem) return null;

  const [{ data: skillLinks }, { data: exampleRows }, { data: hintRows }, { data: starterRows }, { data: datasetRow }] =
    await Promise.all([
      supabase.from("problem_skills").select("skills(name)").eq("problem_id", problem.id),
      supabase
        .from("problem_test_cases")
        .select("input, expected_output, explanation")
        .eq("problem_id", problem.id)
        .eq("is_hidden", false)
        .order("sort_order", { ascending: true }),
      supabase.from("hints").select("level, content").eq("problem_id", problem.id).order("level", { ascending: true }),
      supabase
        .from("problem_starter_code")
        .select("starter_code, languages(slug, display_name)")
        .eq("problem_id", problem.id),
      supabase.from("sql_problem_datasets").select("schema_sql, seed_sql").eq("problem_id", problem.id).maybeSingle(),
    ]);

  let progressStatus: "not_started" | "attempted" | "completed" = "not_started";
  if (userId) {
    const { data: progress } = await supabase
      .from("user_problem_progress")
      .select("status")
      .eq("user_id", userId)
      .eq("problem_id", problem.id)
      .maybeSingle();
    if (progress) progressStatus = progress.status;
  }

  type SkillLinkRow = { skills: { name: string } | null };
  type StarterRow = { starter_code: string; languages: { slug: string; display_name: string } | null };

  return {
    id: problem.id,
    slug: problem.slug,
    title: problem.title,
    statement: problem.statement,
    difficulty: problem.difficulty,
    problemType: problem.problem_type,
    progressionLevel: problem.progression_level,
    learningObjective: problem.learning_objective,
    constraints: problem.constraints,
    expectedTimeComplexity: problem.expected_time_complexity,
    expectedSpaceComplexity: problem.expected_space_complexity,
    skillNames: ((skillLinks as unknown as SkillLinkRow[]) ?? [])
      .map((row) => row.skills?.name)
      .filter((name): name is string => Boolean(name)),
    examples: (exampleRows ?? []).map((row) => ({
      input: row.input,
      expectedOutput: row.expected_output,
      explanation: row.explanation,
    })),
    hints: hintRows ?? [],
    starterCode: ((starterRows as unknown as StarterRow[]) ?? [])
      .filter((row) => row.languages)
      .map((row) => ({
        languageSlug: row.languages!.slug,
        languageName: row.languages!.display_name,
        starterCode: row.starter_code,
      })),
    progressStatus,
    isExecutable: problem.is_executable,
    timeLimitMs: problem.time_limit_ms,
    memoryLimitMb: problem.memory_limit_mb,
    sqlDataset: datasetRow ? { schemaSql: datasetRow.schema_sql, seedSql: datasetRow.seed_sql } : null,
  };
}
