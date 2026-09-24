import type { MasteryLevel } from "@/types/domain";

/**
 * One piece of raw evidence — one submission relevant to one skill.
 * Pure data in, so lib/mastery/mastery.ts never touches Supabase; the
 * mapping from real rows lives in services/mastery/get-skill-evidence.ts.
 */
export interface SkillAttemptEvidence {
  passed: boolean;
  /** problems.difficulty mapped to 1 (intro) .. 5 (boss). */
  difficulty: 1 | 2 | 3 | 4 | 5;
  hintsUsed: number;
  languageSlug: string;
  attemptedAt: Date;
}

export interface MasteryResult {
  masteryScore: number; // 0-100
  confidence: number; // 0-100
  successRate: number; // 0-100
  /** Null when fewer than MIN_INDEPENDENT_EVIDENCE_COUNT hint-free attempts exist — never a fabricated 0. */
  independentScore: number | null;
  level: MasteryLevel;
  evidenceCount: number;
  /** Auditable, human-readable — see EXPLAINABILITY. */
  explanation: string[];
}

/** Per-language mastery, computed with the exact same formula restricted to that language's evidence — see LANGUAGE TRANSFER. */
export interface LanguageMasteryBreakdown {
  languageSlug: string;
  masteryScore: number;
  evidenceCount: number;
}
