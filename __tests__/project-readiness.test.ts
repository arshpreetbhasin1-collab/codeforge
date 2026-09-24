import { describe, it, expect } from "vitest";
import { computeProjectReadiness, type ProjectSkillRequirement } from "@/lib/projects/readiness";

const req = (skillId: string, skillName: string, minMasteryScore: number): ProjectSkillRequirement => ({ skillId, skillName, minMasteryScore });

describe("computeProjectReadiness", () => {
  it("is ready with no explanation of 'Locked' when there are no prerequisites", () => {
    const result = computeProjectReadiness([], new Map());
    expect(result.isReady).toBe(true);
    expect(result.readinessScore).toBe(1);
    expect(result.missingSkills).toEqual([]);
    expect(result.explanation.toLowerCase()).not.toContain("locked");
  });

  it("is ready when every prerequisite skill is fully qualified", () => {
    const requirements = [req("s1", "Arrays", 45), req("s2", "Loops", 45)];
    const mastery = new Map([
      ["s1", 60],
      ["s2", 90],
    ]);
    const result = computeProjectReadiness(requirements, mastery);
    expect(result.isReady).toBe(true);
    expect(result.readinessScore).toBe(1);
    expect(result.missingSkills).toEqual([]);
  });

  it("reports a missing prerequisite with real numbers, never a bare 'Locked'", () => {
    const requirements = [req("s1", "Sorting", 45)];
    const mastery = new Map([["s1", 0]]);
    const result = computeProjectReadiness(requirements, mastery);
    expect(result.isReady).toBe(false);
    expect(result.missingSkills).toEqual([{ skillId: "s1", skillName: "Sorting", requiredMasteryScore: 45, currentMasteryScore: 0 }]);
    expect(result.explanation.toLowerCase()).not.toBe("locked.");
    expect(result.explanation).toContain("Sorting");
  });

  it("cites the missing skill's real mastery percentage when far from ready (not close enough for 'you're close' messaging)", () => {
    // 22/45 = 0.49 contribution -> readinessScore 0.49, below the 0.7 "close" bar on a single-skill project.
    const requirements = [req("s1", "Sorting", 45)];
    const mastery = new Map([["s1", 22]]);
    const result = computeProjectReadiness(requirements, mastery);
    expect(result.isReady).toBe(false);
    expect(result.explanation).toContain("Sorting");
    expect(result.explanation).toContain("22%");
  });

  it("crosses into 'you're close' messaging once the weighted score reaches 0.7", () => {
    const requirements = [req("s1", "Sorting", 45), req("s2", "Recursion", 45)];
    // s1 fully met (contribution 1), s2 at 45% of threshold (contribution 0.45) -> average 0.725 >= 0.7.
    const mastery = new Map([
      ["s1", 45],
      ["s2", 20.25],
    ]);
    const result = computeProjectReadiness(requirements, mastery);
    expect(result.isReady).toBe(false);
    expect(result.readinessScore).toBeGreaterThanOrEqual(0.7);
    expect(result.explanation.toLowerCase()).toContain("you're close");
    expect(result.explanation).toContain("Recursion");
  });

  it("weights readiness by proximity to threshold, not just a binary met/not-met count", () => {
    const requirements = [req("s1", "A", 100), req("s2", "B", 100)];
    const nearlyThere = computeProjectReadiness(requirements, new Map([["s1", 90], ["s2", 90]]));
    const farOff = computeProjectReadiness(requirements, new Map([["s1", 5], ["s2", 5]]));
    expect(nearlyThere.isReady).toBe(false);
    expect(farOff.isReady).toBe(false);
    expect(nearlyThere.readinessScore).toBeGreaterThan(farOff.readinessScore);
  });

  it("never lets mastery above the threshold count for more than 100% of that skill's contribution", () => {
    const requirements = [req("s1", "A", 50)];
    const result = computeProjectReadiness(requirements, new Map([["s1", 100]]));
    expect(result.readinessScore).toBe(1);
    expect(result.isReady).toBe(true);
  });
});
