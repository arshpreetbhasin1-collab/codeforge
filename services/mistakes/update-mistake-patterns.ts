import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { summarizeMistakePatterns, type MistakeOccurrence } from "@/lib/mistakes/patterns";
import { MISTAKE_CATEGORY_LABEL } from "@/lib/mistakes/taxonomy";
import type { MistakeCategory } from "@/types/domain";

/**
 * Rolls a user's full mistake_events history into the mistake_patterns
 * aggregate table (see db/schema/007_progress_and_mastery.sql — that
 * table already exists for exactly this; Prompt 4 populates it instead
 * of duplicating it). pattern_key is the category slug itself — a
 * stable, deterministic key given the fixed 20-category taxonomy.
 */
export async function updateMistakePatterns(supabase: SupabaseClient, userId: string, now: Date = new Date()): Promise<void> {
  const { data: events, error: eventsError } = await supabase
    .from("mistake_events")
    .select("category, detected_at")
    .eq("user_id", userId);

  if (eventsError) {
    throw new Error(`Failed to load mistake events: ${eventsError.message}`);
  }
  if (!events || events.length === 0) return;

  const occurrences: MistakeOccurrence[] = events.map((e) => ({
    category: e.category as MistakeCategory,
    detectedAt: new Date(e.detected_at as string),
  }));

  const summaries = summarizeMistakePatterns(occurrences, now);

  const { error: upsertError } = await supabase.from("mistake_patterns").upsert(
    summaries.map((summary) => ({
      user_id: userId,
      skill_id: null,
      pattern_key: summary.category,
      description: MISTAKE_CATEGORY_LABEL[summary.category],
      occurrence_count: summary.occurrenceCount,
      first_seen_at: summary.firstSeenAt.toISOString(),
      last_seen_at: summary.lastSeenAt.toISOString(),
    })),
    { onConflict: "user_id,pattern_key" },
  );

  if (upsertError) {
    throw new Error(`Failed to update mistake patterns: ${upsertError.message}`);
  }
}
