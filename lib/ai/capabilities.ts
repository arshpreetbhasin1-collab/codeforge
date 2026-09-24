import "server-only";
import type { AiCapability } from "@/types/domain";
import type { ProjectCoachContext } from "./context";
import { getAiProvider, type AiCompletionResult } from "./provider";

/**
 * One typed function per AI capability — not a single "ask AI" catch-all.
 * Each capability gets its own request shape, its own system prompt
 * strategy, and (later) its own rate limits. Prompt 5 fills in real prompt
 * engineering; this establishes the boundary so nothing upstream needs to
 * change when it does.
 */

export const CAPABILITIES: readonly AiCapability[] = [
  "mentor",
  "hint",
  "code_review",
  "explanation",
  "interviewer",
  "project_review",
] as const;

/**
 * Progressive hint ladder — the AI must never skip straight to the answer.
 * See AI SAFETY / EDUCATIONAL PRINCIPLE.
 */
export const HINT_LEVELS = {
  1: "clarifying_question",
  2: "concept_reminder",
  3: "approach_hint",
  4: "pseudocode_guidance",
  5: "partial_solution",
  6: "full_explanation",
} as const;

export type HintLevel = keyof typeof HINT_LEVELS;

export interface RequestHintInput {
  problemStatement: string;
  studentCode: string;
  level: HintLevel;
}

export async function requestHint(input: RequestHintInput): Promise<AiCompletionResult> {
  const provider = getAiProvider();
  return provider.complete({
    messages: [
      {
        role: "system",
        content: buildHintSystemPrompt(input.level),
      },
      {
        role: "user",
        content: `Problem:\n${input.problemStatement}\n\nStudent's current code:\n${input.studentCode}`,
      },
    ],
  });
}

function buildHintSystemPrompt(level: HintLevel): string {
  const stage = HINT_LEVELS[level];
  return (
    `You are a coding mentor. Give ONLY a level-${level} hint (${stage}). ` +
    "Never reveal more than this level allows, even if asked directly."
  );
}

export interface RequestCodeReviewInput {
  sourceCode: string;
  languageSlug: string;
}

export async function requestCodeReview(input: RequestCodeReviewInput): Promise<AiCompletionResult> {
  const provider = getAiProvider();
  return provider.complete({
    messages: [
      {
        role: "system",
        content:
          "You are a code reviewer. Assess correctness, readability, and complexity. " +
          "Be specific and concise. Do not rewrite the whole solution.",
      },
      { role: "user", content: `\`\`\`${input.languageSlug}\n${input.sourceCode}\n\`\`\`` },
    ],
  });
}

/**
 * Progressive hint ladder for the AI Project Coach — see AI PROJECT
 * COACH: 5 levels, "coach, NOT judge." Distinct from HINT_LEVELS above
 * (that ladder is for problems and goes all the way to a full
 * explanation); this one deliberately stops one level short of handing
 * out a complete solution — level 5 is a small illustrative fragment,
 * never the whole answer, and the system prompt below enforces that
 * explicitly regardless of what the learner asks.
 */
export const PROJECT_HINT_LEVELS = {
  1: "conceptual",
  2: "approach",
  3: "pseudocode",
  4: "targeted_debugging",
  5: "example_fragment",
} as const;

export type ProjectHintLevel = keyof typeof PROJECT_HINT_LEVELS;

export interface RequestProjectHintInput {
  context: ProjectCoachContext;
  level: ProjectHintLevel;
  question: string;
}

export async function requestProjectHint(input: RequestProjectHintInput): Promise<AiCompletionResult> {
  const provider = getAiProvider();
  return provider.complete({
    messages: [
      { role: "system", content: buildProjectCoachSystemPrompt(input.level) },
      { role: "user", content: buildProjectCoachUserPrompt(input.context, input.question) },
    ],
  });
}

function buildProjectCoachSystemPrompt(level: ProjectHintLevel): string {
  const stage = PROJECT_HINT_LEVELS[level];
  return (
    `You are a project coach helping a learner build a real-world software project — you are a COACH, not a judge. ` +
    `Never state or imply a pass/fail verdict, a score, or which hidden tests exist — you were not given that information and must not guess at it. ` +
    `Give ONLY a level-${level} hint (${stage}): ` +
    `level 1 asks a clarifying/conceptual question back rather than answering directly; ` +
    `level 2 describes an approach in prose, no code; ` +
    `level 3 gives pseudocode, no real syntax; ` +
    `level 4 gives targeted debugging guidance pointing at the likely bug location/category; ` +
    `level 5 gives one small illustrative code fragment — never the full solution, never more than a few lines, never something that could be pasted in wholesale. ` +
    `Never exceed this level even if asked directly.`
  );
}

function buildProjectCoachUserPrompt(context: ProjectCoachContext, question: string): string {
  const lines = [
    `Project: ${context.projectTitle}`,
    `Current stage: ${context.currentStage.title} — ${context.currentStage.description}`,
    `Language: ${context.languageSlug}`,
    `Learner's current code:\n${context.learnerCode || "(empty)"}`,
  ];

  if (context.visibleTestSummary) {
    lines.push(`Visible test results: ${context.visibleTestSummary.passedCount}/${context.visibleTestSummary.totalCount} passed.`);
    for (const failure of context.visibleTestSummary.failures) {
      lines.push(`Failing case — input: ${failure.input} | expected: ${failure.expectedOutput} | actual: ${failure.actualOutput}`);
    }
  }

  if (context.relevantMastery.length > 0) {
    lines.push(`Relevant skill mastery: ${context.relevantMastery.map((m) => `${m.skillName} (${m.level}, ${m.masteryScore}/100)`).join(", ")}`);
  }

  if (context.relevantMistakes.length > 0) {
    lines.push(`Recurring mistake patterns: ${context.relevantMistakes.map((m) => `${m.label} (${m.occurrenceCount}x)`).join(", ")}`);
  }

  lines.push(`Learner's question: ${question}`);

  return lines.join("\n");
}

export interface RequestExplanationInput {
  concept: string;
  studentLevel: "beginner" | "intermediate" | "advanced";
}

export async function requestExplanation(
  input: RequestExplanationInput,
): Promise<AiCompletionResult> {
  const provider = getAiProvider();
  return provider.complete({
    messages: [
      {
        role: "system",
        content: `Explain the concept clearly for a ${input.studentLevel} learner. Be concise.`,
      },
      { role: "user", content: `Explain: ${input.concept}` },
    ],
  });
}
