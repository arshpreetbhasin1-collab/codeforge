import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateSkillMastery } from "@/lib/mastery/mastery";
import type { LanguageMasteryBreakdown } from "@/lib/mastery/types";
import { getSkillEvidence, groupEvidenceByLanguage } from "./get-skill-evidence";

/**
 * Same skill, same formula, restricted to each language's own evidence —
 * see LANGUAGE TRANSFER: "detect when a concept is understood in one
 * language but not yet applied in another." This is what
 * services/recommendations reads to decide TRANSFER vs CHALLENGE.
 */
export async function getLanguageMasteryBreakdown(
  supabase: SupabaseClient,
  userId: string,
  skillId: string,
  now: Date = new Date(),
): Promise<LanguageMasteryBreakdown[]> {
  const evidence = await getSkillEvidence(supabase, userId, skillId);
  const byLanguage = groupEvidenceByLanguage(evidence);

  return [...byLanguage.entries()].map(([languageSlug, languageEvidence]) => {
    const result = calculateSkillMastery(languageEvidence, now);
    return { languageSlug, masteryScore: result.masteryScore, evidenceCount: result.evidenceCount };
  });
}
