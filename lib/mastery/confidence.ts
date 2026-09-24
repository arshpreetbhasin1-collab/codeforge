import { confidenceForEvidenceCount } from "./weights";

/**
 * How much evidence a mastery score is based on — see MASTERY
 * CONFIDENCE: "A learner who solved one easy problem should not have
 * the same confidence as someone who solved 15 varied problems."
 * Deliberately a function of evidence *count* alone, not of how high the
 * score is — a confidently-measured low score is still confident.
 */
export function calculateConfidence(evidenceCount: number): number {
  return confidenceForEvidenceCount(evidenceCount);
}
