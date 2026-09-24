export interface ProjectSkillRequirement {
  skillId: string;
  skillName: string;
  minMasteryScore: number;
}

export interface MissingProjectSkill {
  skillId: string;
  skillName: string;
  requiredMasteryScore: number;
  currentMasteryScore: number;
}

export interface ProjectReadinessResult {
  /**
   * 0-1 — weighted average, across every prerequisite skill, of
   * min(currentMasteryScore / requiredMasteryScore, 1). Deliberately not a
   * plain "N of M skills met" fraction — see READINESS SCORE: a learner at
   * 90% of every threshold reads as closer to ready than one at 10% of
   * every threshold, even though neither has "met" any skill yet.
   */
  readinessScore: number;
  isReady: boolean;
  missingSkills: MissingProjectSkill[];
  /**
   * Always specific — cites real numbers and a real skill name, never a
   * bare "Locked." See PROJECT READINESS: "You're close. Your Sorting
   * mastery is 48%. Complete one targeted Sorting challenge to unlock
   * this project."
   */
  explanation: string;
}

/**
 * Pure, deterministic readiness scoring — see MASTERY MODEL's discipline
 * applied to projects: same input always produces the same output, no I/O.
 * services/projects/get-project-readiness.ts maps real Supabase rows into
 * this function's inputs; this is the only place the scoring math lives.
 */
export function computeProjectReadiness(
  requirements: ProjectSkillRequirement[],
  masteryBySkill: ReadonlyMap<string, number>,
): ProjectReadinessResult {
  if (requirements.length === 0) {
    return {
      readinessScore: 1,
      isReady: true,
      missingSkills: [],
      explanation: "No prerequisite skills required — you're ready to start.",
    };
  }

  const missingSkills: MissingProjectSkill[] = [];
  let contributionTotal = 0;
  let closest: MissingProjectSkill | null = null;
  let closestContribution = -1;

  for (const requirement of requirements) {
    const requiredScore = requirement.minMasteryScore;
    const currentScore = masteryBySkill.get(requirement.skillId) ?? 0;
    const contribution = requiredScore > 0 ? Math.min(currentScore / requiredScore, 1) : 1;
    contributionTotal += contribution;

    if (contribution < 1) {
      const missing: MissingProjectSkill = {
        skillId: requirement.skillId,
        skillName: requirement.skillName,
        requiredMasteryScore: requiredScore,
        currentMasteryScore: currentScore,
      };
      missingSkills.push(missing);
      if (contribution > closestContribution) {
        closest = missing;
        closestContribution = contribution;
      }
    }
  }

  const readinessScore = Math.round((contributionTotal / requirements.length) * 100) / 100;
  const isReady = missingSkills.length === 0;

  return {
    readinessScore,
    isReady,
    missingSkills,
    explanation: buildReadinessExplanation(readinessScore, missingSkills, closest),
  };
}

function buildReadinessExplanation(readinessScore: number, missingSkills: MissingProjectSkill[], closest: MissingProjectSkill | null): string {
  if (missingSkills.length === 0) {
    return "Every required skill is at threshold — you're ready to build this project.";
  }

  if (readinessScore >= 0.7 && closest) {
    return `You're close. Your ${closest.skillName} mastery is ${closest.currentMasteryScore}%. Complete one targeted ${closest.skillName} challenge to unlock this project.`;
  }

  const detail = missingSkills.map((s) => `${s.skillName} (currently ${s.currentMasteryScore}%, needs ${s.requiredMasteryScore}%)`).join("; ");
  return `Requires ${missingSkills.length} more skill${missingSkills.length === 1 ? "" : "s"} to reach threshold: ${detail}.`;
}
