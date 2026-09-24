import { describe, expect, it } from "vitest";
import { classifySkillRecommendation, getSkillRecommendations } from "@/lib/recommendations/recommendation";
import { difficultyTierForMasteryScore, suggestedDifficultyForType } from "@/lib/recommendations/scoring";
import type { SkillCandidate, RecommendationInput, LearnerPreferences } from "@/lib/recommendations/types";
import type { MasteryResult } from "@/lib/mastery/types";

const NOW = new Date("2026-06-01T00:00:00Z");

function mastery(overrides: Partial<MasteryResult> = {}): MasteryResult {
  return {
    masteryScore: 0,
    confidence: 0,
    successRate: 0,
    independentScore: null,
    level: "not_started",
    evidenceCount: 0,
    explanation: [],
    ...overrides,
  };
}

function candidate(overrides: Partial<SkillCandidate> = {}): SkillCandidate {
  return {
    skillId: "skill-1",
    skillSlug: "loops",
    skillName: "Loops",
    category: "control_flow",
    languageSlug: "python",
    prerequisitesSatisfied: true,
    mastery: mastery(),
    retention: null,
    activePatterns: [],
    siblingLanguages: [],
    ...overrides,
  };
}

describe("difficultyTierForMasteryScore / suggestedDifficultyForType — adaptive difficulty", () => {
  it("maps mastery bands to the five difficulty tiers", () => {
    expect(difficultyTierForMasteryScore(10)).toBe(1);
    expect(difficultyTierForMasteryScore(50)).toBe(2);
    expect(difficultyTierForMasteryScore(70)).toBe(3);
    expect(difficultyTierForMasteryScore(85)).toBe(4);
    expect(difficultyTierForMasteryScore(97)).toBe(5);
  });

  it("PRACTICE/CHALLENGE/TRANSFER suggest the tier the score implies — success nudges harder content", () => {
    expect(suggestedDifficultyForType("PRACTICE", 60)).toBe(2);
    expect(suggestedDifficultyForType("CHALLENGE", 88)).toBe(4);
    expect(suggestedDifficultyForType("TRANSFER", 88)).toBe(4);
  });

  it("REINFORCE/DIAGNOSTIC suggest one tier easier — targeted remediation, not harder content", () => {
    expect(suggestedDifficultyForType("REINFORCE", 60)).toBe(1);
    expect(suggestedDifficultyForType("DIAGNOSTIC", 85)).toBe(3);
  });

  it("never suggests a difficulty below 1 even at the remediation floor", () => {
    expect(suggestedDifficultyForType("REINFORCE", 10)).toBe(1);
  });

  it("LEARN/REVIEW/PROJECT_PREP have no difficulty tier — not difficulty-driven recommendations", () => {
    expect(suggestedDifficultyForType("LEARN", 50)).toBeNull();
    expect(suggestedDifficultyForType("REVIEW", 85)).toBeNull();
    expect(suggestedDifficultyForType("PROJECT_PREP", 50)).toBeNull();
  });
});

describe("Recommendation.estimatedDifficulty / confidence — end to end", () => {
  it("a PRACTICE recommendation carries the mastery-derived difficulty and confidence", () => {
    const result = classifySkillRecommendation(
      candidate({ mastery: mastery({ level: "developing", masteryScore: 55, confidence: 70, evidenceCount: 5 }) }),
    );
    expect(result?.estimatedDifficulty).toBe(2);
    expect(result?.confidence).toBe(70);
  });

  it("a REINFORCE recommendation suggests an easier tier than the raw score implies", () => {
    const result = classifySkillRecommendation(
      candidate({
        mastery: mastery({ level: "competent", masteryScore: 70, confidence: 80, evidenceCount: 10 }),
        activePatterns: [{ category: "off_by_one", occurrenceCount: 4, firstSeenAt: NOW, lastSeenAt: NOW, isActive: true }],
      }),
    );
    expect(result?.type).toBe("REINFORCE");
    expect(result?.estimatedDifficulty).toBe(2); // tier for 70 is 3, remediation drops one tier
  });
});

describe("onboarding-aware ranking — PHASE 15", () => {
  const basePreferences: LearnerPreferences = { preferredLanguageSlug: null, experienceLevel: null, learningGoal: null };

  it("does not change which type applies — only nudges ranking among equally-urgent candidates", () => {
    const withoutPrefs = classifySkillRecommendation(candidate({ prerequisitesSatisfied: false }), basePreferences);
    const withPrefs = classifySkillRecommendation(candidate({ prerequisitesSatisfied: false }), {
      preferredLanguageSlug: "python",
      experienceLevel: "beginner",
      learningGoal: "master_dsa",
    });
    // Still blocked on prerequisites either way — preferences never bypass that.
    expect(withoutPrefs).toBeNull();
    expect(withPrefs).toBeNull();
  });

  it("ranks a skill in the learner's preferred language ahead of an equally-urgent skill in another language", () => {
    const input: RecommendationInput = {
      skills: [
        candidate({ skillId: "s-python", skillSlug: "python-skill", languageSlug: "python", mastery: mastery({ level: "developing", masteryScore: 50, confidence: 70, evidenceCount: 5 }) }),
        candidate({ skillId: "s-java", skillSlug: "java-skill", languageSlug: "java", mastery: mastery({ level: "developing", masteryScore: 50, confidence: 70, evidenceCount: 5 }) }),
      ],
      nearReadyProjects: [],
      preferences: { preferredLanguageSlug: "python", experienceLevel: null, learningGoal: null },
      now: NOW,
    };
    const ranked = getSkillRecommendations(input, 10);
    expect(ranked[0].skillSlug).toBe("python-skill");
  });

  it("ranks a skill matching the learner's goal category ahead of an equally-urgent skill outside it", () => {
    const input: RecommendationInput = {
      skills: [
        candidate({ skillId: "s-algo", skillSlug: "algo-skill", category: "algorithms", mastery: mastery({ level: "developing", masteryScore: 50, confidence: 70, evidenceCount: 5 }) }),
        candidate({ skillId: "s-web", skillSlug: "web-skill", category: "web", mastery: mastery({ level: "developing", masteryScore: 50, confidence: 70, evidenceCount: 5 }) }),
      ],
      nearReadyProjects: [],
      preferences: { preferredLanguageSlug: null, experienceLevel: null, learningGoal: "master_dsa" },
      now: NOW,
    };
    const ranked = getSkillRecommendations(input, 10);
    expect(ranked[0].skillSlug).toBe("algo-skill");
  });

  it("a small preference boost never overrides a genuinely more urgent REINFORCE", () => {
    const input: RecommendationInput = {
      skills: [
        candidate({
          skillId: "s-reinforce",
          skillSlug: "weak-skill",
          languageSlug: "java", // NOT the preferred language
          mastery: mastery({ level: "developing", masteryScore: 50, confidence: 70, evidenceCount: 10 }),
          activePatterns: [{ category: "off_by_one", occurrenceCount: 5, firstSeenAt: NOW, lastSeenAt: NOW, isActive: true }],
        }),
        candidate({
          skillId: "s-practice",
          skillSlug: "preferred-language-skill",
          languageSlug: "python", // preferred language, but no active mistakes
          mastery: mastery({ level: "developing", masteryScore: 50, confidence: 70, evidenceCount: 5 }),
        }),
      ],
      nearReadyProjects: [],
      preferences: { preferredLanguageSlug: "python", experienceLevel: null, learningGoal: null },
      now: NOW,
    };
    const ranked = getSkillRecommendations(input, 10);
    expect(ranked[0].skillSlug).toBe("weak-skill");
    expect(ranked[0].type).toBe("REINFORCE");
  });
});
