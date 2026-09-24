import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { projectStageSubmissionSchema, type ProjectStageSubmissionInput } from "@/lib/validation/schemas";
import { getExecutableLanguage } from "@/lib/execution/registry";
import { generateExecutionId } from "@/lib/execution/execution-id";
import { runJudge, type JudgeTestCase } from "@/services/execution/judge";
import { enforceRateLimit, resolveLanguageId } from "@/services/execution/run-code";
import { deriveVerdictFromOutcomes, type Verdict } from "@/lib/judge/verdicts";
import { computeProjectScore, type ProjectTestOutcomeForScoring } from "@/lib/projects/scoring";
import { classifyAndRecordProjectMistake } from "@/services/mistakes/classify-and-record-project-mistake";
import { timelineMistakeEventType } from "@/lib/mistakes/taxonomy";
import { recalculateSkillMastery, getSkillIdsDemonstratedByProject } from "@/services/mastery/recalculate-skill-mastery";
import { recordLearningEvent } from "@/services/learning/record-learning-event";
import type { ComparisonMode, ProjectScoreBreakdown, ProjectVerdict } from "@/types/domain";

export interface SubmitProjectStageResult {
  projectSubmissionId: string;
  verdict: ProjectVerdict;
  score: number;
  scoreBreakdown: ProjectScoreBreakdown;
  passedCount: number;
  totalCount: number;
  compileOutput: string | null;
  visibleResults: { testCaseId: string; passed: boolean; input: string; expectedOutput: string; actualOutput: string }[];
  hiddenSummary: { passed: number; total: number };
  isProjectComplete: boolean;
  nextStageSlug: string | null;
  reviewId: string;
  executionId: string;
}

interface TestCaseRow {
  id: string;
  input: string;
  expected_output: string;
  is_hidden: boolean;
  is_edge_case: boolean;
  weight: number;
  comparison_mode: ComparisonMode;
  numeric_tolerance: number | null;
  time_limit_ms: number | null;
  memory_limit_mb: number | null;
}

/**
 * SUBMIT: the official, graded attempt for one project stage — see
 * SUBMISSION FLOW: "validate state -> validate code -> run visible+hidden
 * tests -> collect results -> deterministic score -> classify failures ->
 * generate evidence -> update progress -> update mastery -> create
 * learning events." Uses the service-role client for the same reason
 * submit-code.ts does: grading requires reading hidden test cases, which
 * RLS correctly denies to the student's own session. The caller (a Server
 * Action) has already authenticated `userId` from the real session — this
 * function never trusts a client-supplied user id, project state, or
 * score.
 */
export async function submitProjectStage(
  userSupabase: SupabaseClient,
  userId: string,
  input: ProjectStageSubmissionInput,
): Promise<SubmitProjectStageResult> {
  const parsed = projectStageSubmissionSchema.parse(input);
  const executionId = generateExecutionId();

  const language = getExecutableLanguage(parsed.languageSlug);
  if (!language) {
    throw new Error(`Language "${parsed.languageSlug}" is not wired for execution.`);
  }

  await enforceRateLimit(userSupabase, userId, "submissions");

  const admin = createSupabaseAdminClient();

  // --- validate state: the project must actually be started, and the
  // stage must genuinely belong to it — never trust the client's claim.
  const { data: progress } = await admin
    .from("user_project_progress")
    .select("id, verdict, best_score")
    .eq("user_id", userId)
    .eq("project_id", parsed.projectId)
    .maybeSingle();
  if (!progress) {
    throw new Error("Start this project before submitting a stage.");
  }

  const { data: project } = await admin.from("projects").select("id, title, scoring_weights, difficulty").eq("id", parsed.projectId).eq("is_published", true).maybeSingle();
  if (!project) {
    throw new Error("This project doesn't exist or isn't published.");
  }

  const { data: stages } = await admin.from("project_stages").select("id, slug, sort_order").eq("project_id", parsed.projectId).order("sort_order", { ascending: true });
  const orderedStages = stages ?? [];
  const stageIndex = orderedStages.findIndex((s) => s.id === parsed.stageId);
  if (stageIndex === -1) {
    throw new Error("This stage doesn't belong to this project.");
  }
  const stage = orderedStages[stageIndex];
  const isLastStage = stageIndex === orderedStages.length - 1;
  const nextStage = orderedStages[stageIndex + 1] ?? null;

  const { data: testCaseRows } = await admin
    .from("project_test_cases")
    .select("id, input, expected_output, is_hidden, is_edge_case, weight, comparison_mode, numeric_tolerance, time_limit_ms, memory_limit_mb")
    .eq("stage_id", stage.id)
    .order("sort_order", { ascending: true });

  const rows = (testCaseRows as TestCaseRow[]) ?? [];
  if (rows.length === 0) {
    throw new Error("This stage has no test cases configured.");
  }

  const testCases: JudgeTestCase[] = rows.map((row) => ({
    id: row.id,
    input: row.input,
    expectedOutput: row.expected_output,
    comparisonMode: row.comparison_mode,
    numericTolerance: row.numeric_tolerance,
    timeLimitMs: row.time_limit_ms,
    memoryLimitMb: row.memory_limit_mb,
  }));

  let sqlDataset: { schemaSql: string; seedSql: string } | undefined;
  if (parsed.languageSlug === "sql") {
    const { data: dataset } = await admin.from("project_sql_datasets").select("schema_sql, seed_sql").eq("stage_id", stage.id).maybeSingle();
    if (!dataset) throw new Error("This SQL stage has no dataset configured.");
    sqlDataset = { schemaSql: dataset.schema_sql, seedSql: dataset.seed_sql };
  }

  const judgeResult = await runJudge({
    languageSlug: parsed.languageSlug,
    sourceCode: parsed.sourceCode,
    testCases,
    problemLimits: { timeLimitMs: 5000, memoryLimitMb: 256, outputLimitBytes: 64 * 1024 },
    sqlDataset,
  });

  const preTestFailureVerdict: Verdict | null = judgeResult.preTestFailure?.verdict ?? null;
  const judgeVerdict: Verdict = preTestFailureVerdict ?? deriveVerdictFromOutcomes(judgeResult.outcomes);

  const scoringOutcomes: ProjectTestOutcomeForScoring[] = rows.map((row) => {
    const outcome = judgeResult.outcomes.find((o) => o.testCaseId === row.id);
    return {
      passed: outcome?.passed ?? false,
      isHidden: row.is_hidden,
      isEdgeCase: row.is_edge_case,
      verdict: outcome?.verdict ?? judgeVerdict,
    };
  });

  const { overallScore, breakdown, verdict } = computeProjectScore(scoringOutcomes, project.scoring_weights, preTestFailureVerdict);

  const passedCount = scoringOutcomes.filter((o) => o.passed).length;
  const runtimeMs = judgeResult.outcomes.length > 0 ? Math.max(...judgeResult.outcomes.map((o) => o.runtimeMs ?? 0)) : null;
  const memoryKb = judgeResult.outcomes.find((o) => o.memoryUsedKb !== null)?.memoryUsedKb ?? null;
  const languageId = await resolveLanguageId(admin, parsed.languageSlug);

  const { count: priorAttempts } = await admin
    .from("project_submissions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("stage_id", stage.id);

  const { data: submission, error: submissionError } = await admin
    .from("project_submissions")
    .insert({
      user_id: userId,
      project_id: parsed.projectId,
      stage_id: stage.id,
      attempt_number: (priorAttempts ?? 0) + 1,
      language_id: languageId,
      source_code: parsed.sourceCode,
      verdict,
      score: overallScore,
      score_breakdown: breakdown,
      passed_test_count: passedCount,
      total_test_count: rows.length,
      runtime_ms: runtimeMs,
      memory_kb: memoryKb,
      execution_id: executionId,
      compile_output: judgeResult.preTestFailure?.compileOutput ?? null,
      submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (submissionError || !submission) {
    throw new Error("Failed to record project submission.");
  }

  if (judgeResult.outcomes.length > 0) {
    await admin.from("project_test_results").insert(
      judgeResult.outcomes.map((outcome) => ({
        project_submission_id: submission.id,
        test_case_id: outcome.testCaseId,
        passed: outcome.passed,
        actual_output: outcome.actualOutput,
        runtime_ms: outcome.runtimeMs,
        memory_kb: outcome.memoryUsedKb,
        error_type: outcome.errorType,
        stderr: outcome.stderr,
      })),
    );
  }

  // --- classify + mastery, best-effort (never fails the submission the learner already got).
  try {
    const classification = await classifyAndRecordProjectMistake(admin, {
      userId,
      projectSubmissionId: submission.id,
      projectId: parsed.projectId,
      evidence: {
        verdict: judgeVerdict,
        languageSlug: parsed.languageSlug,
        compileOutput: judgeResult.preTestFailure?.compileOutput ?? null,
        stderr: judgeResult.preTestFailure?.stderr ?? judgeResult.outcomes.find((o) => o.stderr)?.stderr ?? "",
        testCases: rows.map((row) => {
          const outcome = judgeResult.outcomes.find((o) => o.testCaseId === row.id);
          return {
            passed: outcome?.passed ?? false,
            isHidden: row.is_hidden,
            isEdgeCase: row.is_edge_case,
            errorType: outcome?.errorType ?? null,
            actualOutput: outcome?.actualOutput ?? null,
            expectedOutput: row.expected_output,
          };
        }),
      },
    });

    if (classification) {
      const timelineEvent = timelineMistakeEventType(classification.category);
      if (timelineEvent) {
        await recordLearningEvent(userSupabase, userId, {
          eventType: timelineEvent,
          projectId: parsed.projectId,
          projectSubmissionId: submission.id,
          metadata: { verdict, category: classification.category, languageSlug: parsed.languageSlug },
        });
      }
    }

    const skillIds = await getSkillIdsDemonstratedByProject(admin, parsed.projectId);
    for (const skillId of skillIds) {
      await recalculateSkillMastery(admin, userId, skillId);
    }
  } catch (adaptiveLearningError) {
    console.error("[submit-project-stage] adaptive learning update failed", adaptiveLearningError);
  }

  // --- update progress: stage-level, then overall project.
  const now = new Date().toISOString();
  const stagePassed = verdict === "passed";

  await admin.from("project_stage_progress").upsert(
    {
      user_id: userId,
      project_id: parsed.projectId,
      stage_id: stage.id,
      status: stagePassed ? "completed" : "in_progress",
      completed_at: stagePassed ? now : null,
    },
    { onConflict: "user_id,stage_id" },
  );

  if (stagePassed) {
    await recordLearningEvent(userSupabase, userId, { eventType: "project_stage_completed", projectId: parsed.projectId, metadata: { stageId: stage.id } });
  }

  const bestScore = Math.max(progress.best_score ?? 0, overallScore);
  const isProjectComplete = stagePassed && isLastStage;

  if (isProjectComplete) {
    await admin.from("user_project_progress").update({ verdict: "passed", best_score: bestScore, completed_at: now }).eq("id", progress.id);
  } else if (stagePassed && nextStage) {
    await admin.from("user_project_progress").update({ verdict: "in_progress", best_score: bestScore, current_stage_id: nextStage.id }).eq("id", progress.id);
    await admin.from("project_stage_progress").upsert(
      { user_id: userId, project_id: parsed.projectId, stage_id: nextStage.id, status: "in_progress", started_at: now },
      { onConflict: "user_id,stage_id" },
    );
    await recordLearningEvent(userSupabase, userId, { eventType: "project_stage_started", projectId: parsed.projectId, metadata: { stageId: nextStage.id } });
  } else if (isLastStage && !stagePassed) {
    // A real attempt at the whole project that didn't pass — see EVALUATION
    // VERDICTS. Never destroys existing 'in_progress' momentum on an
    // earlier retry; only the final stage's own outcome updates the
    // overall verdict this way.
    await admin.from("user_project_progress").update({ verdict, best_score: bestScore }).eq("id", progress.id);
  } else {
    await admin.from("user_project_progress").update({ best_score: bestScore }).eq("id", progress.id);
  }

  // --- deterministic review (AI commentary, if any, is added separately — see AI PROJECT COACH).
  const { data: review, error: reviewError } = await admin
    .from("project_reviews")
    .insert({
      user_id: userId,
      project_id: parsed.projectId,
      project_submission_id: submission.id,
      overall_score: overallScore,
      score_breakdown: breakdown,
      verdict,
      strengths: buildStrengths(breakdown, verdict),
      weaknesses: buildWeaknesses(breakdown, verdict, rows.length - passedCount),
      complexity_assessment: breakdown.efficiency < 100 ? "Execution hit a time, memory, or output limit on at least one test case." : "No resource-limit issues observed.",
      testing_assessment:
        rows.some((r) => r.is_hidden)
          ? `${breakdown.testing}% of hidden test cases passed.`
          : "This stage has no hidden test cases configured.",
      next_recommended_action: nextActionFor(verdict, isProjectComplete, nextStage?.slug ?? null),
    })
    .select("id")
    .single();

  if (reviewError || !review) {
    throw new Error("Failed to record project review.");
  }

  if (isProjectComplete) {
    const { data: portfolioSkills } = await admin.from("project_skills").select("skill_id, skills(name)").eq("project_id", parsed.projectId).eq("relationship", "demonstrates");
    type SkillRow = { skill_id: string; skills: { name: string } | null };
    const skillsDemonstrated = ((portfolioSkills as unknown as SkillRow[]) ?? [])
      .filter((r) => r.skills)
      .map((r) => ({ skillId: r.skill_id, skillName: r.skills!.name, note: `Applied in "${project.title}"` }));

    await admin.from("project_portfolio_entries").insert({
      user_id: userId,
      project_id: parsed.projectId,
      project_submission_id: submission.id,
      project_review_id: review.id,
      score: bestScore,
      skills_demonstrated: skillsDemonstrated,
      language_slug: parsed.languageSlug,
      difficulty: project.difficulty,
      completed_at: now,
    });
  }

  await recordLearningEvent(userSupabase, userId, { eventType: "project_submitted", projectId: parsed.projectId, projectSubmissionId: submission.id, metadata: { stageId: stage.id, verdict, score: overallScore } });
  await recordLearningEvent(userSupabase, userId, {
    eventType: verdict === "passed" ? "project_passed" : "project_failed",
    projectId: parsed.projectId,
    projectSubmissionId: submission.id,
    metadata: { stageId: stage.id, verdict, score: overallScore },
  });
  await recordLearningEvent(userSupabase, userId, { eventType: "project_reviewed", projectId: parsed.projectId, projectSubmissionId: submission.id, metadata: { reviewId: review.id } });

  const visibleResults = rows
    .filter((row) => !row.is_hidden)
    .map((row) => {
      const outcome = judgeResult.outcomes.find((o) => o.testCaseId === row.id);
      return { testCaseId: row.id, passed: outcome?.passed ?? false, input: row.input, expectedOutput: row.expected_output, actualOutput: outcome?.actualOutput ?? "" };
    });

  const hiddenRows = rows.filter((row) => row.is_hidden);
  const hiddenPassed = hiddenRows.filter((row) => judgeResult.outcomes.find((o) => o.testCaseId === row.id)?.passed).length;

  return {
    projectSubmissionId: submission.id,
    verdict,
    score: overallScore,
    scoreBreakdown: breakdown,
    passedCount,
    totalCount: rows.length,
    compileOutput: judgeResult.preTestFailure?.compileOutput ?? null,
    visibleResults,
    hiddenSummary: { passed: hiddenPassed, total: hiddenRows.length },
    isProjectComplete,
    nextStageSlug: !isProjectComplete && stagePassed ? (nextStage?.slug ?? null) : null,
    reviewId: review.id,
    executionId,
  };
}

function buildStrengths(breakdown: ProjectScoreBreakdown, verdict: ProjectVerdict): string[] {
  const strengths: string[] = [];
  if (breakdown.correctness === 100) strengths.push("Every test case for this stage passed.");
  if (breakdown.edgeCases === 100) strengths.push("Handled every edge case correctly.");
  if (breakdown.efficiency === 100) strengths.push("No time, memory, or output limit issues.");
  if (breakdown.codeQuality === 100) strengths.push("Code ran cleanly with no compile or runtime errors.");
  if (verdict === "passed" && strengths.length === 0) strengths.push("Stage passed.");
  return strengths;
}

function buildWeaknesses(breakdown: ProjectScoreBreakdown, verdict: ProjectVerdict, failedCount: number): string[] {
  const weaknesses: string[] = [];
  if (breakdown.correctness < 100) weaknesses.push(`${failedCount} test case(s) did not produce the expected output.`);
  if (breakdown.edgeCases < 100) weaknesses.push("At least one edge case failed.");
  if (breakdown.efficiency < 100) weaknesses.push("Execution hit a resource limit on at least one test case.");
  if (breakdown.codeQuality < 100) weaknesses.push("A compile or runtime error occurred during grading.");
  if (verdict === "passed" && weaknesses.length === 0) weaknesses.push("None identified for this stage.");
  return weaknesses;
}

function nextActionFor(verdict: ProjectVerdict, isProjectComplete: boolean, nextStageSlug: string | null): string {
  if (isProjectComplete) return "Project complete — review your submission or explore the next recommended project.";
  if (verdict === "passed" && nextStageSlug) return "Continue to the next stage.";
  if (verdict === "needs_improvement") return "Review the failing test cases and resubmit this stage.";
  if (verdict === "failed") return "Fix the error preventing this stage from running, then resubmit.";
  return "Resubmit this stage.";
}
