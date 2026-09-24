import type { RecommendationType } from "./types";
import type { SkillCategory, LearningGoal } from "@/types/domain";

/**
 * Base urgency per type — lower runs first. Ordering rationale: an active
 * mistake pattern is corrected before anything else (it actively teaches
 * the wrong thing if left alone); a low-confidence read is resolved
 * before deciding what to teach next; overdue review protects mastery
 * already earned; a fully-ready project (PROJECT) is actionable right
 * now, so it outranks PROJECT_PREP's "almost there" nudge; then new content, practice, transfer, and finally
 * stretch challenges once nothing more pressing exists.
 */
export const RECOMMENDATION_BASE_PRIORITY: Record<RecommendationType, number> = {
  REINFORCE: 10,
  DIAGNOSTIC: 20,
  REVIEW: 30,
  PROJECT: 33,
  PROJECT_PREP: 35,
  LEARN: 40,
  PRACTICE: 50,
  TRANSFER: 60,
  CHALLENGE: 70,
};

/** A pattern needs at least this many occurrences before it drives a REINFORCE recommendation (see lib/mistakes/patterns MIN_PATTERN_OCCURRENCES — same bar). */
export const REINFORCE_MIN_OCCURRENCES = 2;

/** Below this confidence, the mastery score itself is too thin to act on — the right move is more data, not a verdict. */
export const DIAGNOSTIC_MAX_CONFIDENCE = 45;

/** A skill needs at least this mastery score before it counts as satisfying a prerequisite. */
export const PREREQUISITE_MASTERY_THRESHOLD = 45; // "developing"

/** Mastery floor for a skill to be considered a CHALLENGE / TRANSFER candidate. */
export const STRETCH_READY_MASTERY_THRESHOLD = 80; // "strong"

/** Independent-score floor for a CHALLENGE recommendation — a learner who still leans on hints isn't ready to be pushed harder unsupervised. */
export const CHALLENGE_MIN_INDEPENDENT_SCORE = 75;

/** A sibling language below this score is a genuine transfer opportunity, not just "already fine there too." */
export const TRANSFER_MAX_SIBLING_SCORE = 45;

/** A project this close to fully ready is worth surfacing over ordinary practice. */
export const PROJECT_PREP_MIN_READINESS = 0.7;

export function priorityWithTiebreak(type: RecommendationType, urgencyAdjustment: number): number {
  return RECOMMENDATION_BASE_PRIORITY[type] - urgencyAdjustment;
}

// ---------------------------------------------------------------------
// Adaptive difficulty — see PHASE 9: success nudges the next suggested
// tier up, failure/remediation nudges it down. Derived entirely from the
// already-real masteryScore; no new signal is invented.
// ---------------------------------------------------------------------

/** masteryScore band -> the problem difficulty tier (1 intro .. 5 boss) a learner at that score is ready for. */
export function difficultyTierForMasteryScore(masteryScore: number): 1 | 2 | 3 | 4 | 5 {
  if (masteryScore >= 95) return 5;
  if (masteryScore >= 80) return 4;
  if (masteryScore >= 65) return 3;
  if (masteryScore >= 45) return 2;
  return 1;
}

/**
 * REINFORCE/DIAGNOSTIC are remediation, not "keep going at your current
 * level" — see PHASE 9: "do NOT simply throw harder problems... instead
 * an easier targeted problem." One tier below what the raw score implies,
 * floored at 1.
 */
export function suggestedDifficultyForType(type: RecommendationType, masteryScore: number): 1 | 2 | 3 | 4 | 5 | null {
  const tier = difficultyTierForMasteryScore(masteryScore);
  switch (type) {
    case "REINFORCE":
    case "DIAGNOSTIC":
      return (Math.max(1, tier - 1) as 1 | 2 | 3 | 4 | 5);
    case "PRACTICE":
    case "TRANSFER":
    case "CHALLENGE":
      return tier;
    default:
      return null; // LEARN/REVIEW/PROJECT_PREP aren't difficulty-tier recommendations
  }
}

// ---------------------------------------------------------------------
// Onboarding-aware ranking — see PHASE 15: nudges which skill surfaces
// first among otherwise-equally-urgent candidates. Never a hard filter,
// never a prerequisite bypass — only a small priority adjustment.
// ---------------------------------------------------------------------

/** How much more urgent (subtracted from priority) a skill in the learner's chosen language is, all else equal. */
export const LANGUAGE_MATCH_BOOST = 3;

/** Skill categories each onboarding goal cares most about — a real, defensible mapping, not a random weight. */
export const GOAL_CATEGORY_EMPHASIS: Record<LearningGoal, readonly SkillCategory[]> = {
  learn_programming: ["foundations", "control_flow", "functions"],
  master_dsa: ["data_structures", "algorithms", "complexity"],
  interview_prep: ["algorithms", "data_structures", "complexity", "debugging"],
  improve_problem_solving: ["algorithms", "debugging", "control_flow"],
  build_projects: ["functions", "data_structures", "databases", "web"],
};

export const GOAL_CATEGORY_BOOST = 2;
