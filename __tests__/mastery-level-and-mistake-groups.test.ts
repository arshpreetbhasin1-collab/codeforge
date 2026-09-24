import { describe, expect, it } from "vitest";
import { getMasteryLevel } from "@/lib/mastery/weights";
import { MISTAKE_CATEGORY_GROUP, timelineMistakeEventType } from "@/lib/mistakes/taxonomy";
import type { MistakeCategory } from "@/types/domain";

describe("getMasteryLevel", () => {
  it("returns the full interpretable shape for a mid-range score", () => {
    const info = getMasteryLevel(52);
    expect(info).toEqual({ score: 52, level: "developing", label: "Developing", nextThreshold: 65 });
  });

  it("returns null nextThreshold once mastered", () => {
    const info = getMasteryLevel(97);
    expect(info.level).toBe("mastered");
    expect(info.nextThreshold).toBeNull();
  });

  it("returns the first threshold for a zero score", () => {
    const info = getMasteryLevel(0);
    expect(info.level).toBe("not_started");
    expect(info.nextThreshold).toBe(25);
  });

  it("is consistent with masteryLevelForScore at every threshold boundary", () => {
    for (const score of [0, 24, 25, 44, 45, 64, 65, 79, 80, 94, 95, 100]) {
      const info = getMasteryLevel(score);
      expect(info.score).toBe(score);
    }
  });
});

describe("MISTAKE_CATEGORY_GROUP / timelineMistakeEventType", () => {
  it("every mistake category has a group assigned", () => {
    const categories: MistakeCategory[] = [
      "compilation_error", "syntax_error", "type_error", "runtime_error", "time_limit", "output_limit",
      "wrong_answer", "edge_case_failure", "logic_error", "off_by_one", "boundary_error", "input_handling",
      "output_format", "data_structure_misuse", "algorithm_selection", "time_complexity", "space_complexity",
      "sql_query_error", "sql_schema_error", "unknown",
    ];
    for (const category of categories) {
      expect(MISTAKE_CATEGORY_GROUP[category]).toBeDefined();
    }
  });

  it("maps compile-family categories to compilation_mistake", () => {
    expect(timelineMistakeEventType("compilation_error")).toBe("compilation_mistake");
    expect(timelineMistakeEventType("syntax_error")).toBe("compilation_mistake");
    expect(timelineMistakeEventType("type_error")).toBe("compilation_mistake");
  });

  it("maps runtime-family categories to runtime_mistake", () => {
    expect(timelineMistakeEventType("runtime_error")).toBe("runtime_mistake");
    expect(timelineMistakeEventType("data_structure_misuse")).toBe("runtime_mistake");
  });

  it("maps logic and SQL categories to logic_mistake", () => {
    expect(timelineMistakeEventType("wrong_answer")).toBe("logic_mistake");
    expect(timelineMistakeEventType("edge_case_failure")).toBe("logic_mistake");
    expect(timelineMistakeEventType("off_by_one")).toBe("logic_mistake");
    expect(timelineMistakeEventType("sql_query_error")).toBe("logic_mistake");
    expect(timelineMistakeEventType("sql_schema_error")).toBe("logic_mistake");
  });

  it("maps efficiency-family categories to efficiency_mistake", () => {
    expect(timelineMistakeEventType("time_limit")).toBe("efficiency_mistake");
    expect(timelineMistakeEventType("time_complexity")).toBe("efficiency_mistake");
    expect(timelineMistakeEventType("algorithm_selection")).toBe("efficiency_mistake");
  });

  it("returns null for unknown — never fabricates a timeline category", () => {
    expect(timelineMistakeEventType("unknown")).toBeNull();
  });
});
