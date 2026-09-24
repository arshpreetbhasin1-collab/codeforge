import type { SkillCandidate, ProjectProximity, SiblingLanguageMastery } from "./types";
import type { MistakePatternSummary } from "@/lib/mistakes/patterns";
import { MISTAKE_CATEGORY_LABEL } from "@/lib/mistakes/taxonomy";

/** Every builder here cites a concrete number or fact from the candidate — see EXPLAINABILITY. No generic "you should practice this" filler. */

export function reinforceReasons(candidate: SkillCandidate, pattern: MistakePatternSummary): string[] {
  return [
    `${MISTAKE_CATEGORY_LABEL[pattern.category]} has occurred ${pattern.occurrenceCount} times on ${candidate.skillName}, most recently ${pattern.lastSeenAt.toISOString().slice(0, 10)}.`,
    `Current mastery is ${candidate.mastery.masteryScore}/100 with ${candidate.mastery.evidenceCount} attempt(s) recorded.`,
  ];
}

export function diagnosticReasons(candidate: SkillCandidate): string[] {
  return [
    `Mastery confidence for ${candidate.skillName} is only ${candidate.mastery.confidence}/100 — based on just ${candidate.mastery.evidenceCount} attempt(s).`,
    "Not enough evidence yet to know whether the current score reflects real understanding or a lucky/unlucky run.",
  ];
}

export function reviewReasons(candidate: SkillCandidate): string[] {
  const retention = candidate.retention;
  const daysAgo = retention?.daysSinceLastPracticed ?? 0;
  return [
    `${candidate.skillName} was last practiced ${daysAgo} day(s) ago and estimated retention has dropped to "${retention?.label}".`,
    `Stored mastery is ${candidate.mastery.masteryScore}/100; estimated current recall is ${retention?.estimatedCurrentScore}/100.`,
  ];
}

export function learnReasons(candidate: SkillCandidate): string[] {
  return [`${candidate.skillName} has not been started yet, and its prerequisites are already satisfied.`];
}

export function practiceReasons(candidate: SkillCandidate): string[] {
  return [
    `${candidate.skillName} is at "${candidate.mastery.level}" (${candidate.mastery.masteryScore}/100) with ${candidate.mastery.evidenceCount} attempt(s) — more varied practice is the direct path to the next level.`,
  ];
}

export function transferReasons(candidate: SkillCandidate, sibling: SiblingLanguageMastery): string[] {
  return [
    `${candidate.skillName} is strong in ${candidate.languageSlug ?? "this language"} (${candidate.mastery.masteryScore}/100) but only ${sibling.masteryScore}/100 in ${sibling.languageSlug} across ${sibling.evidenceCount} attempt(s).`,
    "The underlying concept is already understood — applying it in another language reinforces transfer rather than re-teaching the idea from scratch.",
  ];
}

export function challengeReasons(candidate: SkillCandidate): string[] {
  return [
    `${candidate.skillName} is mastered independently: ${candidate.mastery.independentScore}/100 without hints across ${candidate.mastery.evidenceCount} attempt(s).`,
    "Ready for a harder problem to keep growth from plateauing.",
  ];
}

export function projectPrepReasons(project: ProjectProximity): string[] {
  const percent = Math.round(project.readinessScore * 100);
  const missing = project.missingSkillNames.length > 0 ? ` Remaining gaps: ${project.missingSkillNames.join(", ")}.` : "";
  return [`${percent}% of the required skills for "${project.projectTitle}" are already at threshold.${missing}`];
}

export function projectReasons(project: ProjectProximity): string[] {
  if (project.progressVerdict === "in_progress") {
    return [`You're partway through "${project.projectTitle}" — pick up where you left off.`];
  }
  if (project.progressVerdict === "needs_improvement" || project.progressVerdict === "failed") {
    return [`Your last submission to "${project.projectTitle}" didn't pass yet — the review has specific next steps.`];
  }
  return [project.explanation];
}
