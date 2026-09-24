import type { ExperienceLevel, LearningGoal, MasteryLevel, MistakeCategory } from "@/types/domain";
import type { Recommendation } from "@/lib/recommendations/types";

/**
 * The shape a future AI mentor reads to answer questions like "Why am I
 * struggling with recursion?" or "What should I practice today?" — see
 * PHASE 17: "AI can explain those results... AI must not invent
 * statistics." Every field here is real data assembled by
 * services/ai/get-learner-context.ts from the same deterministic
 * services the rest of the app uses (getLearnerProfile, mistake_events,
 * submissions) — nothing here calls an AI provider. That wiring is
 * explicitly out of scope until a future prompt actually builds the AI
 * mentor.
 */
export interface AiLearnerContext {
  learnerProfile: {
    displayName: string | null;
    experienceLevel: ExperienceLevel | null;
    learningGoal: LearningGoal | null;
    preferredLanguageSlug: string | null;
  };
  skillMastery: {
    skillName: string;
    masteryScore: number;
    level: MasteryLevel;
    confidence: number;
  }[];
  recentAttempts: {
    problemTitle: string;
    verdict: string;
    languageSlug: string;
    submittedAt: string;
  }[];
  mistakeDNA: {
    category: MistakeCategory;
    label: string;
    occurrenceCount: number;
    lastSeenAt: string;
  }[];
  recommendation: Recommendation | null;
  relevantLessons: {
    title: string;
    slug: string;
    moduleSlug: string;
  }[];
  generatedAt: string;
}

/**
 * What the AI Project Coach is allowed to see — see AI PROJECT COACH:
 * "must NOT get unrestricted DB access... must NOT reveal hidden tests."
 * services/ai/get-project-coach-context.ts assembles this from real data
 * (the same project/mastery/mistake services the rest of the app uses);
 * nothing here ever includes a hidden test's input or expected output —
 * visibleTestFailures only ever comes from visible (is_hidden=false)
 * cases, the same set the learner can already see in the workspace.
 */
export interface ProjectCoachContext {
  projectTitle: string;
  currentStage: { title: string; description: string };
  learnerCode: string;
  languageSlug: string;
  visibleTestSummary: {
    passedCount: number;
    totalCount: number;
    failures: { input: string; expectedOutput: string; actualOutput: string }[];
  } | null;
  relevantMastery: { skillName: string; masteryScore: number; level: MasteryLevel }[];
  relevantMistakes: { category: MistakeCategory; label: string; occurrenceCount: number }[];
  generatedAt: string;
}
