import type { MasteryLevel, ProblemDifficulty } from "@/types/domain";

/**
 * Every tunable number the mastery/confidence/retention formulas use,
 * centralized — see MASTERY LEVELS: "These thresholds should be
 * centralized constants. Do not scatter numbers across components."
 */

// ---------------------------------------------------------------------
// Mastery levels
// ---------------------------------------------------------------------

export const MASTERY_LEVEL_THRESHOLDS: readonly { level: MasteryLevel; min: number }[] = [
  { level: "mastered", min: 95 },
  { level: "strong", min: 80 },
  { level: "competent", min: 65 },
  { level: "developing", min: 45 },
  { level: "exploring", min: 25 },
  { level: "not_started", min: 0 },
];

export function masteryLevelForScore(score: number): MasteryLevel {
  for (const { level, min } of MASTERY_LEVEL_THRESHOLDS) {
    if (score >= min) return level;
  }
  return "not_started";
}

export const MASTERY_LEVEL_LABEL: Record<MasteryLevel, string> = {
  not_started: "Not Started",
  exploring: "Exploring",
  developing: "Developing",
  competent: "Competent",
  strong: "Strong",
  mastered: "Mastered",
};

export interface MasteryLevelInfo {
  score: number;
  level: MasteryLevel;
  label: string;
  /** Score needed to reach the next level up — null when already at the top (mastered). */
  nextThreshold: number | null;
}

/**
 * Single reusable entry point for "what does this score mean" — see
 * MASTERY SCALE: a UI should never re-derive level/label/threshold logic
 * itself, it should call this.
 */
export function getMasteryLevel(score: number): MasteryLevelInfo {
  const level = masteryLevelForScore(score);
  const ascending = [...MASTERY_LEVEL_THRESHOLDS].sort((a, b) => a.min - b.min);
  const currentIndex = ascending.findIndex((t) => t.level === level);
  const next = ascending[currentIndex + 1];

  return {
    score,
    level,
    label: MASTERY_LEVEL_LABEL[level],
    nextThreshold: next ? next.min : null,
  };
}

// ---------------------------------------------------------------------
// Correctness evidence — how much a single passed attempt is worth
// ---------------------------------------------------------------------

/**
 * problems.difficulty ('intro'|'easy'|'medium'|'hard'|'boss') mapped to a
 * 1-5 scale, then to a base score out of 100 — a correct solution to a
 * harder problem is stronger evidence of mastery than an easy one.
 */
export const DIFFICULTY_BASE_SCORE: Readonly<Record<1 | 2 | 3 | 4 | 5, number>> = {
  1: 50, // intro
  2: 62, // easy
  3: 74, // medium
  4: 87, // hard
  5: 100, // boss
};

/** problems.difficulty's five enum values, in the same order as DIFFICULTY_BASE_SCORE's 1-5 scale. */
export const DIFFICULTY_RANK: Readonly<Record<ProblemDifficulty, 1 | 2 | 3 | 4 | 5>> = {
  intro: 1,
  easy: 2,
  medium: 3,
  hard: 4,
  boss: 5,
};

/** Multiplicative penalty per hint used before an accepted solution — see INDEPENDENCE SCORE: hints should discount, not zero out, credit. */
export const HINT_PENALTY_PER_HINT = 0.12;
/** Floor so heavy hint usage still contributes *some* evidence rather than none. */
export const MIN_HINT_MULTIPLIER = 0.4;

export function hintMultiplier(hintsUsed: number): number {
  if (hintsUsed <= 0) return 1;
  return Math.max(MIN_HINT_MULTIPLIER, 1 - hintsUsed * HINT_PENALTY_PER_HINT);
}

// ---------------------------------------------------------------------
// Recency weighting (used inside the mastery average itself, so recent
// performance matters more without discarding older evidence entirely)
// ---------------------------------------------------------------------

/** Days for an attempt's weight in the mastery average to halve. */
export const MASTERY_RECENCY_HALF_LIFE_DAYS = 30;

export function recencyWeight(daysAgo: number, halfLifeDays = MASTERY_RECENCY_HALF_LIFE_DAYS): number {
  return Math.pow(0.5, Math.max(0, daysAgo) / halfLifeDays);
}

// ---------------------------------------------------------------------
// Confidence — separate from mastery; grows toward 100 as evidence
// accumulates, never claiming certainty from a single data point.
// ---------------------------------------------------------------------

/** Evidence count at which confidence reaches 50%. */
export const CONFIDENCE_HALF_POINT_EVIDENCE_COUNT = 3;

export function confidenceForEvidenceCount(evidenceCount: number, halfPoint = CONFIDENCE_HALF_POINT_EVIDENCE_COUNT): number {
  if (evidenceCount <= 0) return 0;
  return Math.round((100 * evidenceCount) / (evidenceCount + halfPoint));
}

// ---------------------------------------------------------------------
// Independence
// ---------------------------------------------------------------------

/** Fewer hint-free attempts than this and independentScore is reported as null — not a fabricated 0. */
export const MIN_INDEPENDENT_EVIDENCE_COUNT = 2;

// ---------------------------------------------------------------------
// Retention / decay — a read-time *projection*, never destructive of the
// stored mastery_score. See RETENTION / DECAY.
// ---------------------------------------------------------------------

/** Days of no practice before retention starts to be reported as anything less than "high". */
export const RETENTION_GRACE_PERIOD_DAYS = 7;
/** Days for the retention estimate to halve after the grace period. */
export const RETENTION_HALF_LIFE_DAYS = 21;
