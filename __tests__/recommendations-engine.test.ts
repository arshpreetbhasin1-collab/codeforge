import { describe, expect, it } from "vitest";
import { classifySkillRecommendation, getNextBestAction, getSkillRecommendations } from "@/lib/recommendations/recommendation";
import type { SkillCandidate, ProjectProximity, RecommendationInput } from "@/lib/recommendations/types";
import type { MasteryResult } from "@/lib/mastery/types";
import type { RetentionEstimate } from "@/lib/mastery/decay";
import type { MistakePatternSummary } from "@/lib/mistakes/patterns";

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

const NO_PREFERENCES = { preferredLanguageSlug: null, experienceLevel: null, learningGoal: null };

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

function pattern(overrides: Partial<MistakePatternSummary> = {}): MistakePatternSummary {
  return {
    category: "off_by_one",
    occurrenceCount: 3,
    firstSeenAt: NOW,
    lastSeenAt: NOW,
    isActive: true,
    ...overrides,
  };
}

function retention(overrides: Partial<RetentionEstimate> = {}): RetentionEstimate {
  return {
    retentionFactor: 1,
    estimatedCurrentScore: 80,
    label: "high",
    daysSinceLastPracticed: 0,
    ...overrides,
  };
}

describe("classifySkillRecommendation — LEARN", () => {
  it("recommends LEARN for an unstarted skill whose prerequisites are satisfied", () => {
    const result = classifySkillRecommendation(candidate({ mastery: mastery({ level: "not_started" }), prerequisitesSatisfied: true }));
    expect(result?.type).toBe("LEARN");
    expect(result?.reasons.length).toBeGreaterThan(0);
  });

  it("recommends nothing for an unstarted skill blocked on prerequisites", () => {
    const result = classifySkillRecommendation(candidate({ mastery: mastery({ level: "not_started" }), prerequisitesSatisfied: false }));
    expect(result).toBeNull();
  });
});

describe("classifySkillRecommendation — REINFORCE", () => {
  it("takes priority over everything else when an active mistake pattern exists", () => {
    const result = classifySkillRecommendation(
      candidate({
        mastery: mastery({ level: "developing", masteryScore: 50, confidence: 80, evidenceCount: 10 }),
        activePatterns: [pattern({ occurrenceCount: 4 })],
      }),
    );
    expect(result?.type).toBe("REINFORCE");
    expect(result?.reasons.some((r) => r.includes("4 times"))).toBe(true);
  });

  it("does not trigger REINFORCE for a pattern below the occurrence threshold", () => {
    const result = classifySkillRecommendation(
      candidate({
        mastery: mastery({ level: "developing", masteryScore: 50, confidence: 80, evidenceCount: 10 }),
        activePatterns: [pattern({ occurrenceCount: 1 })],
      }),
    );
    expect(result?.type).not.toBe("REINFORCE");
  });
});

describe("classifySkillRecommendation — DIAGNOSTIC", () => {
  it("recommends DIAGNOSTIC when confidence is too low to trust the score", () => {
    const result = classifySkillRecommendation(candidate({ mastery: mastery({ level: "developing", masteryScore: 50, confidence: 20, evidenceCount: 1 }) }));
    expect(result?.type).toBe("DIAGNOSTIC");
  });

  it("does not recommend DIAGNOSTIC for a skill with zero evidence (that's LEARN's job)", () => {
    const result = classifySkillRecommendation(candidate({ mastery: mastery({ level: "not_started", confidence: 0, evidenceCount: 0 }) }));
    expect(result?.type).not.toBe("DIAGNOSTIC");
  });
});

describe("classifySkillRecommendation — REVIEW", () => {
  it("recommends REVIEW for a strong skill whose retention has decayed", () => {
    const result = classifySkillRecommendation(
      candidate({
        mastery: mastery({ level: "strong", masteryScore: 85, confidence: 90, evidenceCount: 8 }),
        retention: retention({ label: "low", retentionFactor: 0.4, estimatedCurrentScore: 34, daysSinceLastPracticed: 90 }),
      }),
    );
    expect(result?.type).toBe("REVIEW");
  });

  it("does not recommend REVIEW when retention is still high", () => {
    const result = classifySkillRecommendation(
      candidate({
        mastery: mastery({ level: "strong", masteryScore: 85, confidence: 90, evidenceCount: 8, independentScore: 90 }),
        retention: retention({ label: "high" }),
      }),
    );
    expect(result?.type).not.toBe("REVIEW");
  });
});

describe("classifySkillRecommendation — CHALLENGE and TRANSFER", () => {
  it("recommends CHALLENGE for a strong, independent skill with no transfer opportunity", () => {
    const result = classifySkillRecommendation(
      candidate({
        mastery: mastery({ level: "strong", masteryScore: 88, confidence: 90, evidenceCount: 8, independentScore: 85 }),
        retention: retention({ label: "high" }),
        siblingLanguages: [{ languageSlug: "java", masteryScore: 80, evidenceCount: 5 }],
      }),
    );
    expect(result?.type).toBe("CHALLENGE");
  });

  it("recommends TRANSFER instead of CHALLENGE when a sibling language is weak", () => {
    const result = classifySkillRecommendation(
      candidate({
        mastery: mastery({ level: "strong", masteryScore: 88, confidence: 90, evidenceCount: 8, independentScore: 85 }),
        retention: retention({ label: "high" }),
        siblingLanguages: [{ languageSlug: "java", masteryScore: 10, evidenceCount: 1 }],
      }),
    );
    expect(result?.type).toBe("TRANSFER");
    expect(result?.reasons.some((r) => r.includes("java"))).toBe(true);
  });

  it("recommends PRACTICE, not CHALLENGE, when mastery is strong but still hint-dependent", () => {
    const result = classifySkillRecommendation(
      candidate({
        mastery: mastery({ level: "strong", masteryScore: 82, confidence: 90, evidenceCount: 8, independentScore: 20 }),
        retention: retention({ label: "high" }),
      }),
    );
    expect(result?.type).toBe("PRACTICE");
  });
});

describe("classifySkillRecommendation — PRACTICE", () => {
  it("recommends PRACTICE for a mid-range skill with no other concerns", () => {
    const result = classifySkillRecommendation(candidate({ mastery: mastery({ level: "developing", masteryScore: 55, confidence: 70, evidenceCount: 5 }) }));
    expect(result?.type).toBe("PRACTICE");
  });
});

describe("getNextBestAction / getSkillRecommendations", () => {
  it("returns null when there is nothing actionable", () => {
    const input: RecommendationInput = { skills: [], nearReadyProjects: [], preferences: NO_PREFERENCES, now: NOW };
    expect(getNextBestAction(input)).toBeNull();
  });

  it("ranks REINFORCE above PRACTICE and LEARN", () => {
    const input: RecommendationInput = {
      skills: [
        candidate({ skillId: "s-learn", skillSlug: "recursion", mastery: mastery({ level: "not_started" }), prerequisitesSatisfied: true }),
        candidate({
          skillId: "s-practice",
          skillSlug: "arrays",
          mastery: mastery({ level: "developing", masteryScore: 55, confidence: 70, evidenceCount: 5 }),
        }),
        candidate({
          skillId: "s-reinforce",
          skillSlug: "loops",
          mastery: mastery({ level: "developing", masteryScore: 55, confidence: 70, evidenceCount: 5 }),
          activePatterns: [pattern({ occurrenceCount: 5 })],
        }),
      ],
      nearReadyProjects: [],
      preferences: NO_PREFERENCES,
      now: NOW,
    };

    const next = getNextBestAction(input);
    expect(next?.type).toBe("REINFORCE");
    expect(next?.skillSlug).toBe("loops");

    const ranked = getSkillRecommendations(input, 10);
    expect(ranked.map((r) => r.type)).toEqual(["REINFORCE", "LEARN", "PRACTICE"]);
  });

  it("surfaces PROJECT_PREP once a project is close to ready", () => {
    const project: ProjectProximity = {
      projectId: "p-1",
      projectSlug: "todo-app",
      projectTitle: "Todo App",
      readinessScore: 0.9,
      isReady: false,
      missingSkillNames: ["Error Handling"],
      explanation: "You're close. Your Error Handling mastery is 40%. Complete one targeted Error Handling challenge to unlock this project.",
      progressVerdict: "not_started",
    };
    const input: RecommendationInput = {
      skills: [candidate({ mastery: mastery({ level: "developing", masteryScore: 55, confidence: 70, evidenceCount: 5 }) })],
      nearReadyProjects: [project],
      preferences: NO_PREFERENCES,
      now: NOW,
    };

    const ranked = getSkillRecommendations(input, 10);
    expect(ranked.some((r) => r.type === "PROJECT_PREP" && r.projectSlug === "todo-app")).toBe(true);
  });

  it("surfaces PROJECT once every prerequisite skill is at threshold, never alongside PROJECT_PREP for the same project", () => {
    const project: ProjectProximity = {
      projectId: "p-2",
      projectSlug: "inventory-system",
      projectTitle: "Inventory Management System",
      readinessScore: 1,
      isReady: true,
      missingSkillNames: [],
      explanation: "Every required skill is at threshold — you're ready to build this project.",
      progressVerdict: "not_started",
    };
    const input: RecommendationInput = {
      skills: [candidate({ mastery: mastery({ level: "developing", masteryScore: 55, confidence: 70, evidenceCount: 5 }) })],
      nearReadyProjects: [project],
      preferences: NO_PREFERENCES,
      now: NOW,
    };

    const ranked = getSkillRecommendations(input, 10);
    expect(ranked.some((r) => r.type === "PROJECT" && r.projectSlug === "inventory-system")).toBe(true);
    expect(ranked.some((r) => r.type === "PROJECT_PREP" && r.projectSlug === "inventory-system")).toBe(false);
  });

  it("does not recommend PROJECT for an already-passed project", () => {
    const project: ProjectProximity = {
      projectId: "p-3",
      projectSlug: "url-shortener",
      projectTitle: "URL Shortener",
      readinessScore: 1,
      isReady: true,
      missingSkillNames: [],
      explanation: "Every required skill is at threshold — you're ready to build this project.",
      progressVerdict: "passed",
    };
    const input: RecommendationInput = {
      skills: [],
      nearReadyProjects: [project],
      preferences: NO_PREFERENCES,
      now: NOW,
    };

    const ranked = getSkillRecommendations(input, 10);
    expect(ranked.some((r) => r.projectSlug === "url-shortener")).toBe(false);
  });

  it("every returned recommendation carries at least one concrete reason", () => {
    const input: RecommendationInput = {
      skills: [
        candidate({ mastery: mastery({ level: "not_started" }), prerequisitesSatisfied: true }),
        candidate({ skillId: "s2", skillSlug: "conditionals", mastery: mastery({ level: "developing", masteryScore: 55, confidence: 70, evidenceCount: 5 }) }),
      ],
      nearReadyProjects: [],
      preferences: NO_PREFERENCES,
      now: NOW,
    };
    for (const rec of getSkillRecommendations(input, 10)) {
      expect(rec.reasons.length).toBeGreaterThan(0);
      for (const reason of rec.reasons) expect(reason.length).toBeGreaterThan(0);
    }
  });

  it("is deterministic for identical input regardless of skill array order", () => {
    const skills = [
      candidate({ skillId: "a", skillSlug: "a-skill", mastery: mastery({ level: "developing", masteryScore: 40, confidence: 60, evidenceCount: 3 }) }),
      candidate({ skillId: "b", skillSlug: "b-skill", mastery: mastery({ level: "developing", masteryScore: 60, confidence: 60, evidenceCount: 3 }) }),
    ];
    const forward = getSkillRecommendations({ skills, nearReadyProjects: [], preferences: NO_PREFERENCES, now: NOW }, 10);
    const reversed = getSkillRecommendations({ skills: [...skills].reverse(), nearReadyProjects: [], preferences: NO_PREFERENCES, now: NOW }, 10);
    expect(forward.map((r) => r.skillSlug)).toEqual(reversed.map((r) => r.skillSlug));
  });
});
