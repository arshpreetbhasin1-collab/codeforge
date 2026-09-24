import type { MasteryLevel } from "@/types/domain";

/**
 * Spaced-repetition scheduling — how long until a skill at a given
 * mastery level is due for review again. See RETENTION / DECAY: reviews
 * should get less frequent as mastery solidifies, standard spaced-
 * repetition shape. A skill that's barely started isn't "due for
 * review" yet — it's still being learned for the first time, so those
 * levels schedule nothing.
 */
export const REVIEW_INTERVAL_DAYS: Readonly<Partial<Record<MasteryLevel, number>>> = {
  developing: 3,
  competent: 7,
  strong: 14,
  mastered: 30,
};

export function computeNextReviewDueAt(level: MasteryLevel, lastAttemptedAt: Date): Date | null {
  const intervalDays = REVIEW_INTERVAL_DAYS[level];
  if (intervalDays === undefined) return null;
  return new Date(lastAttemptedAt.getTime() + intervalDays * 24 * 60 * 60 * 1000);
}
