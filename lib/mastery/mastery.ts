import type { SkillAttemptEvidence, MasteryResult } from "./types";
import {
  DIFFICULTY_BASE_SCORE,
  hintMultiplier,
  recencyWeight,
  masteryLevelForScore,
  MIN_INDEPENDENT_EVIDENCE_COUNT,
} from "./weights";
import { calculateConfidence } from "./confidence";

/**
 * The deterministic mastery formula — see MASTERY MODEL. Conceptually:
 *
 *   masteryScore = recency-weighted average of (difficulty × hint
 *                  discount) across every attempt, where a FAILED
 *                  attempt contributes 0 rather than being excluded.
 *
 * That last point is what makes this "consistency-aware" without a
 * bolted-on separate consistency term: a learner who fails 4 times then
 * passes once scores lower than one who passes on the first try, because
 * the failures still occupy weight in the average, they just contribute
 * nothing to the numerator. No single passed attempt can push the score
 * to 100 on its own unless it's essentially the only evidence — see
 * ABSOLUTE RULES: "Do NOT mark a learner as mastered simply because one
 * submission was Accepted."
 *
 * Deterministic (same input always produces the same output), bounded
 * (always 0-100), and smooth (a new attempt shifts a weighted average,
 * never a hard reset) — see MASTERY MODEL's five requirements.
 */
export function calculateSkillMastery(evidence: SkillAttemptEvidence[], now: Date = new Date()): MasteryResult {
  const evidenceCount = evidence.length;

  if (evidenceCount === 0) {
    return {
      masteryScore: 0,
      confidence: 0,
      successRate: 0,
      independentScore: null,
      level: "not_started",
      evidenceCount: 0,
      explanation: ["No attempts recorded yet."],
    };
  }

  const passed = evidence.filter((e) => e.passed);
  const successRate = Math.round((100 * passed.length) / evidenceCount);

  const masteryScore = recencyWeightedCorrectnessAverage(evidence, now);
  const confidence = calculateConfidence(evidenceCount);

  const hintFree = evidence.filter((e) => e.hintsUsed === 0);
  const independentScore =
    hintFree.length >= MIN_INDEPENDENT_EVIDENCE_COUNT ? recencyWeightedCorrectnessAverage(hintFree, now) : null;

  const level = masteryLevelForScore(masteryScore);

  return {
    masteryScore,
    confidence,
    successRate,
    independentScore,
    level,
    evidenceCount,
    explanation: buildExplanation(evidence, passed, hintFree, now),
  };
}

function recencyWeightedCorrectnessAverage(evidence: SkillAttemptEvidence[], now: Date): number {
  let weightedSum = 0;
  let weightTotal = 0;

  for (const attempt of evidence) {
    const daysAgo = daysBetween(attempt.attemptedAt, now);
    const weight = recencyWeight(daysAgo);
    weightTotal += weight;
    if (attempt.passed) {
      weightedSum += weight * DIFFICULTY_BASE_SCORE[attempt.difficulty] * hintMultiplier(attempt.hintsUsed);
    }
  }

  if (weightTotal === 0) return 0;
  return Math.round(Math.max(0, Math.min(100, weightedSum / weightTotal)));
}

function daysBetween(earlier: Date, later: Date): number {
  return Math.max(0, (later.getTime() - earlier.getTime()) / (1000 * 60 * 60 * 24));
}

function buildExplanation(
  all: SkillAttemptEvidence[],
  passed: SkillAttemptEvidence[],
  hintFree: SkillAttemptEvidence[],
  now: Date,
): string[] {
  const lines: string[] = [`${passed.length} of ${all.length} attempt(s) passed`];

  const mostRecent = all.reduce((latest, e) => (e.attemptedAt > latest.attemptedAt ? e : latest), all[0]);
  const daysAgo = Math.round(daysBetween(mostRecent.attemptedAt, now));
  lines.push(daysAgo === 0 ? "Most recent attempt: today" : `Most recent attempt: ${daysAgo} day(s) ago`);

  const hintedCount = all.length - hintFree.length;
  if (hintedCount > 0) {
    lines.push(`${hintedCount} attempt(s) used at least one hint`);
  }
  if (hintFree.length >= MIN_INDEPENDENT_EVIDENCE_COUNT) {
    lines.push(`${hintFree.length} attempt(s) solved without hints`);
  } else if (hintedCount > 0 || all.length > 0) {
    lines.push("Not enough hint-free attempts yet to measure independent mastery");
  }

  const languages = [...new Set(all.map((e) => e.languageSlug))];
  if (languages.length > 1) {
    lines.push(`Evidence spans ${languages.length} languages: ${languages.join(", ")}`);
  }

  return lines;
}
