import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyMistake } from "@/lib/mistakes/classifier";
import type { SubmissionMistakeEvidence, MistakeClassification } from "@/lib/mistakes/types";
import { updateMistakePatterns } from "./update-mistake-patterns";

/**
 * The single write path for mistake_events — see MISTAKE DNA: "every
 * classification must be traceable to one specific submission." Returns
 * null (and writes nothing) for an accepted submission — there is no
 * mistake to record. After recording, rolls the new event into the
 * user's mistake_patterns aggregate so REINFORCE recommendations see it
 * immediately.
 */
export async function classifyAndRecordMistake(
  supabase: SupabaseClient,
  params: { userId: string; submissionId: string; problemId: string; evidence: SubmissionMistakeEvidence },
  now: Date = new Date(),
): Promise<MistakeClassification | null> {
  const classification = classifyMistake(params.evidence);
  if (!classification) return null;

  const { error } = await supabase.from("mistake_events").insert({
    user_id: params.userId,
    submission_id: params.submissionId,
    problem_id: params.problemId,
    category: classification.category,
    confidence: classification.confidence,
    evidence: classification.evidence,
  });

  if (error) {
    throw new Error(`Failed to record mistake event: ${error.message}`);
  }

  await updateMistakePatterns(supabase, params.userId, now);

  return classification;
}
