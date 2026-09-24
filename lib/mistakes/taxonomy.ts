import type { MistakeCategory } from "@/types/domain";

/** Human-readable labels for the 20-category taxonomy — see db/schema/016_adaptive_learning.sql's mistake_category enum, which this must match exactly. */
export const MISTAKE_CATEGORY_LABEL: Record<MistakeCategory, string> = {
  compilation_error: "Compilation Error",
  syntax_error: "Syntax Error",
  type_error: "Type Error",
  runtime_error: "Runtime Error",
  time_limit: "Time Limit Exceeded",
  output_limit: "Output Limit Exceeded",
  wrong_answer: "Wrong Answer",
  edge_case_failure: "Edge Case Failure",
  logic_error: "Logic Error",
  off_by_one: "Off-by-One Error",
  boundary_error: "Boundary Error",
  input_handling: "Input Handling Error",
  output_format: "Output Format Mismatch",
  data_structure_misuse: "Data Structure Misuse",
  algorithm_selection: "Algorithm Selection",
  time_complexity: "Time Complexity",
  space_complexity: "Space Complexity",
  sql_query_error: "SQL Query Error",
  sql_schema_error: "SQL Schema Error",
  unknown: "Unclassified",
  architecture_error: "Architecture Error",
  testing_gap: "Testing Gap",
};

/**
 * Categories that reflect the program never running correctly at all
 * (as opposed to running but producing a wrong result) — used by
 * lib/recommendations to decide whether a REVIEW or a DIAGNOSTIC is the
 * right next action.
 */
export const PRE_TEST_CATEGORIES: readonly MistakeCategory[] = [
  "compilation_error",
  "syntax_error",
  "type_error",
  "time_limit",
  "output_limit",
  "sql_query_error",
  "sql_schema_error",
];

/**
 * The higher-level groupings Mistake DNA displays — see PHASE 4's
 * CONCEPTUAL/IMPLEMENTATION/COMPILATION/RUNTIME/LOGIC/EFFICIENCY/SQL
 * buckets. "conceptual" deliberately has no members: detecting *why* a
 * mistake happened (a genuine misunderstanding vs. a slip) isn't a signal
 * classifyMistake() can read from judge output — see ABSOLUTE RULES:
 * "Do NOT fabricate signals that don't exist." The bucket exists so the
 * UI has a name for it if a future signal source ever populates it,
 * rather than needing a new type later.
 */
export type MistakeGroup = "conceptual" | "implementation" | "compilation" | "runtime" | "logic" | "efficiency" | "sql" | "unclassified";

export const MISTAKE_GROUP_LABEL: Record<MistakeGroup, string> = {
  conceptual: "Conceptual",
  implementation: "Implementation",
  compilation: "Compilation",
  runtime: "Runtime",
  logic: "Logic",
  efficiency: "Efficiency",
  sql: "SQL",
  unclassified: "Unclassified",
};

export const MISTAKE_CATEGORY_GROUP: Record<MistakeCategory, MistakeGroup> = {
  compilation_error: "compilation",
  syntax_error: "compilation",
  type_error: "compilation",
  runtime_error: "runtime",
  data_structure_misuse: "runtime",
  off_by_one: "implementation",
  boundary_error: "implementation",
  input_handling: "implementation",
  output_format: "implementation",
  wrong_answer: "logic",
  edge_case_failure: "logic",
  logic_error: "logic",
  time_limit: "efficiency",
  output_limit: "efficiency",
  time_complexity: "efficiency",
  space_complexity: "efficiency",
  algorithm_selection: "efficiency",
  sql_query_error: "sql",
  sql_schema_error: "sql",
  unknown: "unclassified",
  // Project-only categories (see db/schema/020_project_engine.sql) — both
  // are "the code ran, but was built wrong" concerns, same family as
  // off_by_one/boundary_error/input_handling/output_format.
  architecture_error: "implementation",
  testing_gap: "implementation",
};

/**
 * The coarse learning_events timeline bucket a category rolls up to —
 * see db/schema/019's logic_mistake addition. There's no dedicated
 * "implementation_mistake" timeline type, so off-by-one/boundary/input-
 * handling/output-format mistakes roll up to logic_mistake too (they're
 * all "wrong output" failure modes); SQL mistakes roll up there as well.
 * Mistake DNA (lib/mistakes/patterns.ts) still tracks each of these as
 * its own distinct category — this collapsing only affects the coarse
 * timeline display.
 */
export function timelineMistakeEventType(category: MistakeCategory): "compilation_mistake" | "runtime_mistake" | "logic_mistake" | "efficiency_mistake" | null {
  const group = MISTAKE_CATEGORY_GROUP[category];
  switch (group) {
    case "compilation":
      return "compilation_mistake";
    case "runtime":
      return "runtime_mistake";
    case "efficiency":
      return "efficiency_mistake";
    case "logic":
    case "implementation":
    case "sql":
      return "logic_mistake";
    default:
      return null;
  }
}
