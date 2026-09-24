import type { MistakeCategory } from "@/types/domain";

/** One classified mistake_events row, reduced to just what pattern-detection needs. */
export interface MistakeOccurrence {
  category: MistakeCategory;
  detectedAt: Date;
}

export interface MistakePatternSummary {
  category: MistakeCategory;
  occurrenceCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  /** Recent AND repeated enough to still be worth surfacing — see MISTAKE DNA: a single old occurrence isn't "a pattern." */
  isActive: boolean;
}

/** A category must repeat at least this many times before it's called a pattern rather than a one-off. */
export const MIN_PATTERN_OCCURRENCES = 2;

/** A pattern not seen again within this window is considered resolved/stale, not active. */
export const PATTERN_RECENCY_WINDOW_DAYS = 30;

/**
 * Groups raw mistake occurrences into per-category rollups — the same
 * shape mistake_patterns stores, computed here as a pure function so it's
 * independently testable from the Supabase upsert in
 * services/mistakes/get-mistake-patterns.ts.
 */
export function summarizeMistakePatterns(occurrences: MistakeOccurrence[], now: Date = new Date()): MistakePatternSummary[] {
  const byCategory = new Map<MistakeCategory, MistakeOccurrence[]>();
  for (const occurrence of occurrences) {
    const existing = byCategory.get(occurrence.category);
    if (existing) existing.push(occurrence);
    else byCategory.set(occurrence.category, [occurrence]);
  }

  const summaries: MistakePatternSummary[] = [];
  for (const [category, entries] of byCategory) {
    const sorted = [...entries].sort((a, b) => a.detectedAt.getTime() - b.detectedAt.getTime());
    const firstSeenAt = sorted[0].detectedAt;
    const lastSeenAt = sorted[sorted.length - 1].detectedAt;
    const daysSinceLastSeen = (now.getTime() - lastSeenAt.getTime()) / (1000 * 60 * 60 * 24);

    summaries.push({
      category,
      occurrenceCount: sorted.length,
      firstSeenAt,
      lastSeenAt,
      isActive: sorted.length >= MIN_PATTERN_OCCURRENCES && daysSinceLastSeen <= PATTERN_RECENCY_WINDOW_DAYS,
    });
  }

  return summaries.sort((a, b) => b.occurrenceCount - a.occurrenceCount || b.lastSeenAt.getTime() - a.lastSeenAt.getTime());
}

/** The active patterns only, most frequent first — what the recommendation engine and learner profile actually display. */
export function topActivePatterns(occurrences: MistakeOccurrence[], limit: number, now: Date = new Date()): MistakePatternSummary[] {
  return summarizeMistakePatterns(occurrences, now)
    .filter((s) => s.isActive)
    .slice(0, limit);
}
