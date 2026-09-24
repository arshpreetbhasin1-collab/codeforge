import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MistakeEvent, MistakePattern } from "@/types/domain";

export interface MistakeProfile {
  /** Most recent classified mistakes, newest first — raw evidence for the "recent activity" view. */
  recentEvents: MistakeEvent[];
  /** The persisted, cross-skill rollup — what mistake_patterns already stores. */
  topPatterns: MistakePattern[];
}

const RECENT_EVENT_LIMIT = 20;
const TOP_PATTERN_LIMIT = 5;

/** Read-only view over a learner's mistake history — what /progress and getLearnerProfile() display. */
export async function getMistakeProfile(supabase: SupabaseClient, userId: string): Promise<MistakeProfile> {
  const [{ data: eventRows, error: eventsError }, { data: patternRows, error: patternsError }] = await Promise.all([
    supabase
      .from("mistake_events")
      .select("id, user_id, submission_id, problem_id, project_submission_id, project_id, category, confidence, evidence, detected_at")
      .eq("user_id", userId)
      .order("detected_at", { ascending: false })
      .limit(RECENT_EVENT_LIMIT),
    supabase
      .from("mistake_patterns")
      .select("id, user_id, skill_id, pattern_key, description, occurrence_count, first_seen_at, last_seen_at")
      .eq("user_id", userId)
      // Same tie-break as lib/mistakes/patterns.ts's summarizeMistakePatterns:
      // ties on occurrence_count go to whichever was seen most recently.
      .order("occurrence_count", { ascending: false })
      .order("last_seen_at", { ascending: false })
      .limit(TOP_PATTERN_LIMIT),
  ]);

  if (eventsError) throw new Error(`Failed to load mistake events: ${eventsError.message}`);
  if (patternsError) throw new Error(`Failed to load mistake patterns: ${patternsError.message}`);

  return {
    recentEvents: (eventRows ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      submissionId: row.submission_id,
      problemId: row.problem_id,
      projectSubmissionId: row.project_submission_id,
      projectId: row.project_id,
      category: row.category,
      confidence: row.confidence,
      evidence: row.evidence,
      detectedAt: row.detected_at,
    })),
    topPatterns: (patternRows ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      skillId: row.skill_id,
      patternKey: row.pattern_key,
      description: row.description,
      occurrenceCount: row.occurrence_count,
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
    })),
  };
}
