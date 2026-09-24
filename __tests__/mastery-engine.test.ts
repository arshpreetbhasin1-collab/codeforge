import { describe, expect, it } from "vitest";
import { calculateSkillMastery } from "@/lib/mastery/mastery";
import { calculateConfidence } from "@/lib/mastery/confidence";
import { estimateRetention } from "@/lib/mastery/decay";
import { masteryLevelForScore } from "@/lib/mastery/weights";
import type { SkillAttemptEvidence } from "@/lib/mastery/types";

const NOW = new Date("2026-06-01T00:00:00Z");

function attempt(overrides: Partial<SkillAttemptEvidence> = {}): SkillAttemptEvidence {
  return {
    passed: true,
    difficulty: 3,
    hintsUsed: 0,
    languageSlug: "python",
    attemptedAt: NOW,
    ...overrides,
  };
}

describe("calculateSkillMastery — no evidence", () => {
  it("reports not_started with zeroed scores rather than guessing", () => {
    const result = calculateSkillMastery([], NOW);
    expect(result).toMatchObject({
      masteryScore: 0,
      confidence: 0,
      successRate: 0,
      independentScore: null,
      level: "not_started",
      evidenceCount: 0,
    });
  });
});

describe("calculateSkillMastery — single attempt", () => {
  it("one successful easy attempt does not claim mastery — see ABSOLUTE RULES", () => {
    const result = calculateSkillMastery([attempt({ difficulty: 2 })], NOW);
    expect(result.masteryScore).toBeLessThan(80);
    expect(result.level).not.toBe("mastered");
    expect(result.level).not.toBe("strong");
  });

  it("a single failed attempt scores 0, not a fabricated partial value", () => {
    const result = calculateSkillMastery([attempt({ passed: false })], NOW);
    expect(result.masteryScore).toBe(0);
    expect(result.successRate).toBe(0);
  });
});

describe("calculateSkillMastery — repeated successful attempts", () => {
  it("increases evidence-backed confidence as attempts accumulate", () => {
    const one = calculateSkillMastery([attempt()], NOW);
    const five = calculateSkillMastery(Array(5).fill(attempt()), NOW);
    expect(five.confidence).toBeGreaterThan(one.confidence);
  });

  it("consistent passes at the same difficulty converge, not spike unboundedly", () => {
    const evidence = Array(10).fill(attempt({ difficulty: 3 }));
    const result = calculateSkillMastery(evidence, NOW);
    expect(result.masteryScore).toBeLessThanOrEqual(100);
    expect(result.masteryScore).toBeGreaterThan(60);
  });
});

describe("calculateSkillMastery — mixed success/failure", () => {
  it("a mix of passes and fails scores lower than an equal number of pure passes", () => {
    const allPassed = calculateSkillMastery(Array(4).fill(attempt()), NOW);
    const mixed = calculateSkillMastery(
      [attempt(), attempt({ passed: false }), attempt(), attempt({ passed: false })],
      NOW,
    );
    expect(mixed.masteryScore).toBeLessThan(allPassed.masteryScore);
  });

  it("does not simply average away failures to zero if most attempts pass", () => {
    const evidence = [
      attempt(),
      attempt(),
      attempt(),
      attempt(),
      attempt({ passed: false }),
    ];
    const result = calculateSkillMastery(evidence, NOW);
    expect(result.masteryScore).toBeGreaterThan(0);
  });
});

describe("calculateSkillMastery — hints", () => {
  it("penalizes hint usage without excluding the attempt entirely", () => {
    const withHints = calculateSkillMastery([attempt({ hintsUsed: 3 })], NOW);
    const withoutHints = calculateSkillMastery([attempt({ hintsUsed: 0 })], NOW);
    expect(withHints.masteryScore).toBeLessThan(withoutHints.masteryScore);
    expect(withHints.masteryScore).toBeGreaterThan(0);
  });

  it("independentScore is null with too little hint-free evidence, never a fabricated number", () => {
    const result = calculateSkillMastery([attempt({ hintsUsed: 2 })], NOW);
    expect(result.independentScore).toBeNull();
  });

  it("independentScore reflects only hint-free attempts once there are enough of them", () => {
    const evidence = [
      attempt({ hintsUsed: 0, difficulty: 5 }),
      attempt({ hintsUsed: 0, difficulty: 5 }),
      attempt({ hintsUsed: 4, difficulty: 1, passed: false }),
    ];
    const result = calculateSkillMastery(evidence, NOW);
    expect(result.independentScore).not.toBeNull();
    // The hinted failure should not drag down a score computed from only the two hint-free passes.
    expect(result.independentScore).toBeGreaterThan(80);
  });
});

describe("calculateSkillMastery — difficulty differences", () => {
  it("a passed hard problem is worth more evidence than a passed intro problem", () => {
    const easy = calculateSkillMastery([attempt({ difficulty: 1 })], NOW);
    const hard = calculateSkillMastery([attempt({ difficulty: 5 })], NOW);
    expect(hard.masteryScore).toBeGreaterThan(easy.masteryScore);
  });
});

describe("calculateSkillMastery — recency", () => {
  it("a stale-but-perfect history and a mixed-but-recent history are both real signals a formula can differentiate", () => {
    const longAgo = new Date("2026-01-01T00:00:00Z"); // 5 months before NOW
    const stale = calculateSkillMastery(Array(3).fill(attempt({ attemptedAt: longAgo })), NOW);
    const recent = calculateSkillMastery(Array(3).fill(attempt({ attemptedAt: NOW })), NOW);
    // Recency weighting only changes the *rate of change*, not stored history —
    // both remain valid non-zero scores, but recent evidence should not score lower.
    expect(recent.masteryScore).toBeGreaterThanOrEqual(stale.masteryScore);
  });

  it("a recent pass outweighs an old fail from the same skill in the running average", () => {
    const longAgo = new Date("2025-01-01T00:00:00Z");
    const evidence = [attempt({ passed: false, attemptedAt: longAgo }), attempt({ passed: true, attemptedAt: NOW })];
    const result = calculateSkillMastery(evidence, NOW);
    // With the old failure almost fully decayed, this should look close to a lone recent pass.
    const soloRecent = calculateSkillMastery([attempt({ attemptedAt: NOW })], NOW);
    expect(result.masteryScore).toBeGreaterThan(soloRecent.masteryScore * 0.8);
  });
});

describe("calculateSkillMastery — determinism and bounds", () => {
  it("is deterministic for identical input", () => {
    const evidence = [attempt(), attempt({ passed: false }), attempt({ hintsUsed: 1 })];
    const a = calculateSkillMastery(evidence, NOW);
    const b = calculateSkillMastery(evidence, NOW);
    expect(a).toEqual(b);
  });

  it("never exceeds 100 or drops below 0 regardless of input shape", () => {
    const evidence = Array(20).fill(attempt({ difficulty: 5, hintsUsed: 0 }));
    const result = calculateSkillMastery(evidence, NOW);
    expect(result.masteryScore).toBeLessThanOrEqual(100);
    expect(result.masteryScore).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(100);
  });

  it("always returns an auditable explanation", () => {
    const result = calculateSkillMastery([attempt()], NOW);
    expect(result.explanation.length).toBeGreaterThan(0);
  });
});

describe("calculateConfidence", () => {
  it("low evidence yields low confidence", () => {
    expect(calculateConfidence(1)).toBeLessThan(40);
  });

  it("high evidence yields high confidence, approaching but not fabricating certainty", () => {
    const confidence = calculateConfidence(20);
    expect(confidence).toBeGreaterThan(80);
    expect(confidence).toBeLessThanOrEqual(100);
  });

  it("is monotonically non-decreasing in evidence count", () => {
    let previous = 0;
    for (const n of [0, 1, 2, 3, 5, 8, 13, 21]) {
      const confidence = calculateConfidence(n);
      expect(confidence).toBeGreaterThanOrEqual(previous);
      previous = confidence;
    }
  });
});

describe("masteryLevelForScore", () => {
  it("maps scores to the documented bands", () => {
    expect(masteryLevelForScore(0)).toBe("not_started");
    expect(masteryLevelForScore(24)).toBe("not_started");
    expect(masteryLevelForScore(25)).toBe("exploring");
    expect(masteryLevelForScore(44)).toBe("exploring");
    expect(masteryLevelForScore(45)).toBe("developing");
    expect(masteryLevelForScore(64)).toBe("developing");
    expect(masteryLevelForScore(65)).toBe("competent");
    expect(masteryLevelForScore(79)).toBe("competent");
    expect(masteryLevelForScore(80)).toBe("strong");
    expect(masteryLevelForScore(94)).toBe("strong");
    expect(masteryLevelForScore(95)).toBe("mastered");
    expect(masteryLevelForScore(100)).toBe("mastered");
  });
});

describe("estimateRetention", () => {
  it("returns null when the skill has never been reviewed", () => {
    expect(estimateRetention(80, null, NOW)).toBeNull();
  });

  it("reports high retention immediately after practicing", () => {
    const result = estimateRetention(80, NOW, NOW);
    expect(result?.label).toBe("high");
    expect(result?.estimatedCurrentScore).toBe(80);
  });

  it("decreases retention gradually after a long gap, never destroying the stored score itself", () => {
    const longAgo = new Date(NOW.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
    const result = estimateRetention(80, longAgo, NOW);
    expect(result).not.toBeNull();
    expect(result!.estimatedCurrentScore).toBeLessThan(80);
    expect(result!.label).not.toBe("high");
    // The floor keeps this from claiming near-total forgetting of real mastery.
    expect(result!.estimatedCurrentScore).toBeGreaterThan(0);
  });

  it("does not penalize retention within the grace period", () => {
    const threeDaysAgo = new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000);
    const result = estimateRetention(80, threeDaysAgo, NOW);
    expect(result?.retentionFactor).toBe(1);
  });
});
