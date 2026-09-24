import type { RecommendationInput, Recommendation, RecommendationType, SkillCandidate, ProjectProximity, SiblingLanguageMastery, LearnerPreferences } from "./types";
import type { MistakePatternSummary } from "@/lib/mistakes/patterns";
import {
  REINFORCE_MIN_OCCURRENCES,
  DIAGNOSTIC_MAX_CONFIDENCE,
  CHALLENGE_MIN_INDEPENDENT_SCORE,
  TRANSFER_MAX_SIBLING_SCORE,
  PROJECT_PREP_MIN_READINESS,
  LANGUAGE_MATCH_BOOST,
  GOAL_CATEGORY_BOOST,
  GOAL_CATEGORY_EMPHASIS,
  suggestedDifficultyForType,
  priorityWithTiebreak,
} from "./scoring";
import {
  reinforceReasons,
  diagnosticReasons,
  reviewReasons,
  learnReasons,
  practiceReasons,
  transferReasons,
  challengeReasons,
  projectPrepReasons,
  projectReasons,
} from "./reasons";

const STRETCH_LEVELS = new Set(["strong", "mastered"]);
const PRACTICE_LEVELS = new Set(["exploring", "developing", "competent"]);

const NO_PREFERENCES: LearnerPreferences = { preferredLanguageSlug: null, experienceLevel: null, learningGoal: null };

/**
 * Picks at most one recommendation type per skill — the most urgent
 * applicable one, in the order described in scoring.ts's doc comment.
 * Returns null when the skill genuinely needs no action right now
 * (blocked on prerequisites, or already strong with no active concerns).
 * `preferences` only ever nudges ranking among otherwise-applicable
 * candidates (see PHASE 15) — it never changes *whether* a type applies.
 */
export function classifySkillRecommendation(candidate: SkillCandidate, preferences: LearnerPreferences = NO_PREFERENCES): Recommendation | null {
  const preferenceBoost = preferenceBoostFor(candidate, preferences);

  const strongestPattern = topPattern(candidate.activePatterns);
  if (strongestPattern && strongestPattern.occurrenceCount >= REINFORCE_MIN_OCCURRENCES) {
    return buildRecommendation("REINFORCE", candidate, reinforceReasons(candidate, strongestPattern), strongestPattern.occurrenceCount + preferenceBoost);
  }

  if (candidate.mastery.evidenceCount > 0 && candidate.mastery.confidence < DIAGNOSTIC_MAX_CONFIDENCE) {
    return buildRecommendation(
      "DIAGNOSTIC",
      candidate,
      diagnosticReasons(candidate),
      DIAGNOSTIC_MAX_CONFIDENCE - candidate.mastery.confidence + preferenceBoost,
    );
  }

  if (STRETCH_LEVELS.has(candidate.mastery.level) && candidate.retention && candidate.retention.label !== "high") {
    const urgency = 10 * (1 - candidate.retention.retentionFactor);
    return buildRecommendation("REVIEW", candidate, reviewReasons(candidate), urgency + preferenceBoost);
  }

  if (candidate.mastery.level === "not_started") {
    if (candidate.prerequisitesSatisfied) {
      return buildRecommendation("LEARN", candidate, learnReasons(candidate), preferenceBoost);
    }
    return null; // blocked — nothing actionable yet
  }

  if (STRETCH_LEVELS.has(candidate.mastery.level)) {
    const readyForStretch = candidate.mastery.independentScore !== null && candidate.mastery.independentScore >= CHALLENGE_MIN_INDEPENDENT_SCORE;

    if (readyForStretch) {
      const transferTarget = findTransferOpportunity(candidate.siblingLanguages);
      if (transferTarget) {
        return buildRecommendation("TRANSFER", candidate, transferReasons(candidate, transferTarget), preferenceBoost);
      }
      return buildRecommendation("CHALLENGE", candidate, challengeReasons(candidate), preferenceBoost);
    }

    return buildRecommendation("PRACTICE", candidate, practiceReasons(candidate), preferenceBoost);
  }

  if (PRACTICE_LEVELS.has(candidate.mastery.level)) {
    const urgency = (100 - candidate.mastery.masteryScore) / 100; // weaker skills nudge slightly ahead of stronger ones
    return buildRecommendation("PRACTICE", candidate, practiceReasons(candidate), urgency + preferenceBoost);
  }

  return null;
}

/** Small, bounded nudge — never enough to override a genuine urgency difference (REINFORCE's smallest boost is +2, larger than this can ever reach). */
function preferenceBoostFor(candidate: SkillCandidate, preferences: LearnerPreferences): number {
  let boost = 0;
  if (preferences.preferredLanguageSlug && candidate.languageSlug === preferences.preferredLanguageSlug) {
    boost += LANGUAGE_MATCH_BOOST;
  }
  if (preferences.learningGoal && GOAL_CATEGORY_EMPHASIS[preferences.learningGoal].includes(candidate.category)) {
    boost += GOAL_CATEGORY_BOOST;
  }
  return boost;
}

function classifyProjectRecommendation(project: ProjectProximity): Recommendation | null {
  // Once ready, classifyProjectReadyRecommendation takes over — a project
  // is either "almost there" (PROJECT_PREP) or "go build it" (PROJECT),
  // never both at once.
  if (project.isReady) return null;
  if (project.readinessScore < PROJECT_PREP_MIN_READINESS) return null;
  return {
    type: "PROJECT_PREP",
    skillId: null,
    skillSlug: null,
    skillName: null,
    projectId: project.projectId,
    projectSlug: project.projectSlug,
    projectTitle: project.projectTitle,
    priority: priorityWithTiebreak("PROJECT_PREP", project.readinessScore * 10),
    reasons: projectPrepReasons(project),
    confidence: Math.round(project.readinessScore * 100),
    estimatedDifficulty: null,
  };
}

/**
 * A project this learner can actually start (or continue) right now — see
 * PROJECT ENGINE / RECOMMENDATION. Nothing to recommend once already
 * passed (that's a portfolio entry, not a next action).
 */
function classifyProjectReadyRecommendation(project: ProjectProximity): Recommendation | null {
  if (!project.isReady) return null;
  if (project.progressVerdict === "passed") return null;

  const urgencyAdjustment = project.progressVerdict === "in_progress" ? 5 : 0;
  return {
    type: "PROJECT",
    skillId: null,
    skillSlug: null,
    skillName: null,
    projectId: project.projectId,
    projectSlug: project.projectSlug,
    projectTitle: project.projectTitle,
    priority: priorityWithTiebreak("PROJECT", urgencyAdjustment),
    reasons: projectReasons(project),
    confidence: 100,
    estimatedDifficulty: null,
  };
}

/**
 * The single most urgent thing this learner should do next — see
 * ADAPTIVE RECOMMENDATION ENGINE. Returns null only when there is
 * genuinely nothing actionable (no skills to evaluate, or every skill is
 * either blocked on prerequisites or already strong with no active
 * concerns and no nearby project).
 */
export function getNextBestAction(input: RecommendationInput): Recommendation | null {
  const all = allRecommendations(input);
  if (all.length === 0) return null;
  return all[0];
}

/** Ranked list of the top `limit` recommendations across all skills and nearby projects — one per skill/project, most urgent first. */
export function getSkillRecommendations(input: RecommendationInput, limit: number): Recommendation[] {
  return allRecommendations(input).slice(0, limit);
}

function allRecommendations(input: RecommendationInput): Recommendation[] {
  const skillRecs = input.skills
    .map((candidate) => classifySkillRecommendation(candidate, input.preferences))
    .filter((r): r is Recommendation => r !== null);
  const projectPrepRecs = input.nearReadyProjects.map(classifyProjectRecommendation).filter((r): r is Recommendation => r !== null);
  const projectReadyRecs = input.nearReadyProjects.map(classifyProjectReadyRecommendation).filter((r): r is Recommendation => r !== null);

  return [...skillRecs, ...projectPrepRecs, ...projectReadyRecs].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    // Deterministic tiebreak so output ordering never depends on array/object iteration order.
    const aKey = a.skillSlug ?? a.projectSlug ?? "";
    const bKey = b.skillSlug ?? b.projectSlug ?? "";
    return aKey.localeCompare(bKey);
  });
}

function buildRecommendation(
  type: RecommendationType,
  candidate: SkillCandidate,
  reasons: string[],
  urgencyAdjustment: number,
): Recommendation {
  return {
    type,
    skillId: candidate.skillId,
    skillSlug: candidate.skillSlug,
    skillName: candidate.skillName,
    projectId: null,
    projectSlug: null,
    projectTitle: null,
    priority: priorityWithTiebreak(type, urgencyAdjustment),
    reasons,
    confidence: candidate.mastery.confidence,
    estimatedDifficulty: suggestedDifficultyForType(type, candidate.mastery.masteryScore),
  };
}

function topPattern(patterns: MistakePatternSummary[]): MistakePatternSummary | null {
  if (patterns.length === 0) return null;
  return [...patterns].sort((a, b) => b.occurrenceCount - a.occurrenceCount)[0];
}

function findTransferOpportunity(siblings: SiblingLanguageMastery[]): SiblingLanguageMastery | null {
  const candidates = siblings.filter((s) => s.masteryScore < TRANSFER_MAX_SIBLING_SCORE);
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => a.masteryScore - b.masteryScore)[0];
}
