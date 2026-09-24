import type { UUID, SkillCategory, ExperienceLevel, LearningGoal } from "@/types/domain";
import type { MasteryResult } from "@/lib/mastery/types";
import type { RetentionEstimate } from "@/lib/mastery/decay";
import type { MistakePatternSummary } from "@/lib/mistakes/patterns";

/**
 * The 8 recommendation types — see ADAPTIVE RECOMMENDATION ENGINE. Each
 * one answers a different question about what the learner should do
 * next; lib/recommendations/recommendation.ts picks at most one per
 * skill (the most urgent applicable type), never several competing
 * suggestions for the same skill.
 */
export type RecommendationType =
  | "LEARN"
  | "PRACTICE"
  | "REINFORCE"
  | "REVIEW"
  | "DIAGNOSTIC"
  | "TRANSFER"
  | "CHALLENGE"
  | "PROJECT_PREP"
  | "PROJECT";

/** Mastery of the same skill concept in a language other than the one primarily being evaluated — see LANGUAGE TRANSFER. */
export interface SiblingLanguageMastery {
  languageSlug: string;
  masteryScore: number;
  evidenceCount: number;
}

/**
 * Everything the recommendation engine needs about one skill for one
 * learner. Pure data in — the mapping from real skill_mastery /
 * mistake_patterns / skill_dependencies rows lives in
 * services/recommendations/get-next-best-action.ts.
 */
export interface SkillCandidate {
  skillId: UUID;
  skillSlug: string;
  skillName: string;
  category: SkillCategory;
  languageSlug: string | null;
  /** True when every skill this one depends on (skill_dependencies) already meets the DEVELOPING threshold. */
  prerequisitesSatisfied: boolean;
  mastery: MasteryResult;
  retention: RetentionEstimate | null;
  /** Only patterns already attributed to this skill — filtering happens in the service layer, not here. */
  activePatterns: MistakePatternSummary[];
  siblingLanguages: SiblingLanguageMastery[];
}

/**
 * Onboarding preferences (Prompt 5) — see PHASE 15: "Actually use those
 * values." These only ever nudge ranking (tie-break scoring) or filter
 * which language a problem/lesson destination is resolved in — they
 * never skip a prerequisite or fabricate readiness. All three are
 * nullable because onboarding may not be complete yet.
 */
export interface LearnerPreferences {
  preferredLanguageSlug: string | null;
  experienceLevel: ExperienceLevel | null;
  learningGoal: LearningGoal | null;
}

/** How close a learner is to a specific project's prerequisite skills — see PROJECT READINESS FOUNDATION. */
export interface ProjectProximity {
  projectId: UUID;
  projectSlug: string;
  projectTitle: string;
  /** 0-1 — weighted average of how close each prerequisite skill is to its threshold. */
  readinessScore: number;
  /** Every prerequisite skill is at or above its threshold. */
  isReady: boolean;
  missingSkillNames: string[];
  /** Always specific — see services/projects/get-project-readiness.ts's buildReadinessExplanation(). Never a bare "Locked." */
  explanation: string;
  /** This learner's own progress on the project, if any. */
  progressVerdict: "not_started" | "in_progress" | "passed" | "needs_improvement" | "failed";
}

export interface RecommendationInput {
  skills: SkillCandidate[];
  nearReadyProjects: ProjectProximity[];
  preferences: LearnerPreferences;
  now: Date;
}

export interface Recommendation {
  type: RecommendationType;
  skillId: UUID | null;
  skillSlug: string | null;
  skillName: string | null;
  projectId: UUID | null;
  projectSlug: string | null;
  projectTitle: string | null;
  /** Lower = more urgent. Used only for ranking; never shown to the learner. */
  priority: number;
  /** Always non-empty and specific — see EXPLAINABILITY: "never recommend without saying why." */
  reasons: string[];
  /** 0-100 — how much evidence backs this suggestion. Not a second mastery score; see PHASE 7's example shape. */
  confidence: number;
  /** 1 (intro) - 5 (boss) — the difficulty tier to aim for next, derived from mastery. Null for types where difficulty doesn't apply (LEARN/REVIEW/PROJECT_PREP). */
  estimatedDifficulty: 1 | 2 | 3 | 4 | 5 | null;
}
