import { describe, expect, it } from "vitest";
import {
  buildSkillGraph,
  detectCycle,
  getDependents,
  getPrerequisites,
  getUnlockedSkills,
  isSkillUnlocked,
  topologicalOrder,
} from "@/lib/learning/skill-graph";
import type { Skill, SkillDependency } from "@/types/domain";

function makeSkill(id: string, overrides: Partial<Skill> = {}): Skill {
  return {
    id,
    slug: id,
    name: id,
    description: "",
    category: "foundations",
    languageId: null,
    difficulty: 1,
    ...overrides,
  };
}

function makeDependency(skillId: string, prerequisiteSkillId: string): SkillDependency {
  return { id: `${skillId}<-${prerequisiteSkillId}`, skillId, prerequisiteSkillId };
}

// variables -> control-flow -> functions
const skills: Skill[] = [makeSkill("variables"), makeSkill("control-flow"), makeSkill("functions")];
const dependencies: SkillDependency[] = [
  makeDependency("control-flow", "variables"),
  makeDependency("functions", "control-flow"),
];

describe("skill graph", () => {
  it("reports no prerequisites for a root skill", () => {
    const graph = buildSkillGraph(skills, dependencies);
    expect(getPrerequisites(graph, "variables")).toEqual([]);
  });

  it("reports direct prerequisites for a dependent skill", () => {
    const graph = buildSkillGraph(skills, dependencies);
    const prereqs = getPrerequisites(graph, "control-flow");
    expect(prereqs.map((s) => s.id)).toEqual(["variables"]);
  });

  it("reports dependents of a skill", () => {
    const graph = buildSkillGraph(skills, dependencies);
    const dependents = getDependents(graph, "variables");
    expect(dependents.map((s) => s.id)).toEqual(["control-flow"]);
  });

  it("unlocks a root skill with no prerequisites", () => {
    const graph = buildSkillGraph(skills, dependencies);
    expect(isSkillUnlocked(graph, "variables", new Set())).toBe(true);
  });

  it("keeps a dependent skill locked until its prerequisite is mastered", () => {
    const graph = buildSkillGraph(skills, dependencies);
    expect(isSkillUnlocked(graph, "control-flow", new Set())).toBe(false);
    expect(isSkillUnlocked(graph, "control-flow", new Set(["variables"]))).toBe(true);
  });

  it("does not unlock a skill via a partial prerequisite chain", () => {
    const graph = buildSkillGraph(skills, dependencies);
    // functions requires control-flow, not variables directly
    expect(isSkillUnlocked(graph, "functions", new Set(["variables"]))).toBe(false);
  });

  it("computes the full set of currently-unlocked skills", () => {
    const graph = buildSkillGraph(skills, dependencies);
    const unlocked = getUnlockedSkills(graph, new Set(["variables"]));
    expect(unlocked.map((s) => s.id).sort()).toEqual(["control-flow", "variables"]);
  });

  it("detects no cycle in a valid DAG", () => {
    const graph = buildSkillGraph(skills, dependencies);
    expect(detectCycle(graph)).toBeNull();
  });

  it("detects a cycle when the skill graph is malformed", () => {
    const cyclicDeps: SkillDependency[] = [
      makeDependency("control-flow", "variables"),
      makeDependency("variables", "control-flow"),
    ];
    const graph = buildSkillGraph(skills, cyclicDeps);
    expect(detectCycle(graph)).not.toBeNull();
  });

  it("produces a topological order where prerequisites come first", () => {
    const graph = buildSkillGraph(skills, dependencies);
    const order = topologicalOrder(graph).map((s) => s.id);
    expect(order.indexOf("variables")).toBeLessThan(order.indexOf("control-flow"));
    expect(order.indexOf("control-flow")).toBeLessThan(order.indexOf("functions"));
  });
});
