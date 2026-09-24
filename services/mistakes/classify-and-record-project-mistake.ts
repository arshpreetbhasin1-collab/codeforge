import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyMistake } from "@/lib/mistakes/classifier";
import type { SubmissionMistakeEvidence, MistakeClassification } from "@/lib/mistakes/types";
import { updateMistakePatterns } from "./update-mistake-patterns";

/**
 * Project-submission counterpart to classifyAndRecordMistake — reuses
 * classifyMistake() (the same 20+2-category taxonomy, zero new
 * classification logic) but writes project_submission_id/project_id
 * instead of submission_id/problem_id, per db/schema/020_project_engine.sql's
 * exactly-one-source mistake_events extension. See MISTAKE REUSE: "reuse
 * the existing taxonomy."
 */
export async function classifyAndRecordProjectMistake(
  supabase: SupabaseClient,
  params: { userId: string; projectSubmissionId: string; projectId: string; evidence: SubmissionMistakeEvidence },
  now: Date = new Date(),
): Promise<MistakeClassification | null> {
  const classification = classifyMistake(params.evidence);
  if (!classification) return null;

  const { error } = await supabase.from("mistake_events").insert({
    user_id: params.userId,
    project_submission_id: params.projectSubmissionId,
    project_id: params.projectId,
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
