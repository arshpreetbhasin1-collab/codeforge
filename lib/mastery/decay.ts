import { RETENTION_GRACE_PERIOD_DAYS, RETENTION_HALF_LIFE_DAYS } from "./weights";

/**
 * A recency-weighted *retention estimate* — see RETENTION / DECAY: "Do
 * NOT claim medical/psychological precision. The purpose is educational
 * scheduling." This is a read-time projection only. It never touches the
 * stored mastery_score — see IMMUTABLE EVIDENCE / "Never permanently
 * destroy historical mastery."
 */

export type RetentionLabel = "high" | "medium" | "low";

export interface RetentionEstimate {
  /** 0-1 — how much of masteryScore is assumed to still be "live" recall. */
  retentionFactor: number;
  /** masteryScore * retentionFactor, for display alongside the stored score — not stored anywhere itself. */
  estimatedCurrentScore: number;
  label: RetentionLabel;
  daysSinceLastPracticed: number;
}

/** Forgetting doesn't erase well-learned material entirely — a floor keeps this from claiming near-zero recall for old but real mastery. */
const MIN_RETENTION_FACTOR = 0.35;

export function estimateRetention(
  masteryScore: number,
  lastReviewedAt: Date | null,
  now: Date = new Date(),
): RetentionEstimate | null {
  if (lastReviewedAt === null) return null;

  const daysSinceLastPracticed = Math.max(0, (now.getTime() - lastReviewedAt.getTime()) / (1000 * 60 * 60 * 24));

  const daysPastGrace = Math.max(0, daysSinceLastPracticed - RETENTION_GRACE_PERIOD_DAYS);
  const retentionFactor = Math.max(MIN_RETENTION_FACTOR, Math.pow(0.5, daysPastGrace / RETENTION_HALF_LIFE_DAYS));

  return {
    retentionFactor: Math.round(retentionFactor * 100) / 100,
    estimatedCurrentScore: Math.round(masteryScore * retentionFactor),
    label: labelForRetentionFactor(retentionFactor),
    daysSinceLastPracticed: Math.round(daysSinceLastPracticed),
  };
}

function labelForRetentionFactor(factor: number): RetentionLabel {
  if (factor >= 0.85) return "high";
  if (factor >= 0.6) return "medium";
  return "low";
}
