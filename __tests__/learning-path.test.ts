import { describe, expect, it } from "vitest";
import { buildSkillGraph } from "@/lib/learning/skill-graph";
import { recommendNextSkill } from "@/lib/learning/path";
import type { Skill, SkillDependency } from "@/types/domain";

function makeSkill(id: string): Skill {
  return {
    id,
    slug: id,
    name: id,
    description: "",
    category: "foundations",
    languageId: null,
    difficulty: 1,
  };
}

const skills: Skill[] = [makeSkill("variables"), makeSkill("control-flow"), makeSkill("arrays")];
const dependencies: SkillDependency[] = [
  { id: "1", skillId: "control-flow", prerequisiteSkillId: "variables" },
  { id: "2", skillId: "arrays", prerequisiteSkillId: "variables" },
];

describe("recommendNextSkill", () => {
  it("recommends an unlocked, never-attempted skill first", () => {
    const graph = buildSkillGraph(skills, dependencies);
    const recommendation = recommendNextSkill(graph, { scoreBySkillId: new Map() });
    expect(recommendation).toEqual({ skillId: "variables", reason: "unlocked_unattempted" });
  });

  it("recommends the weakest unlocked skill once everything unlocked has been attempted", () => {
    const graph = buildSkillGraph(skills, dependencies);
    const recommendation = recommendNextSkill(graph, {
      scoreBySkillId: new Map([
        ["variables", 90],
        ["control-flow", 40],
        ["arrays", 70],
      ]),
    });
    expect(recommendation?.skillId).toBe("control-flow");
    expect(recommendation?.reason).toBe("unlocked_low_mastery");
  });

  it("never recommends a locked skill", () => {
    const graph = buildSkillGraph(skills, dependencies);
    const recommendation = recommendNextSkill(graph, {
      scoreBySkillId: new Map([["variables", 30]]),
    });
    // variables itself is unlocked and below threshold, so it should win —
    // control-flow/arrays are locked until variables crosses the threshold.
    expect(recommendation?.skillId).toBe("variables");
  });

  it("returns null once every skill is mastered", () => {
    const graph = buildSkillGraph(skills, dependencies);
    const recommendation = recommendNextSkill(graph, {
      scoreBySkillId: new Map([
        ["variables", 100],
        ["control-flow", 100],
        ["arrays", 100],
      ]),
    });
    expect(recommendation).toBeNull();
  });
});
