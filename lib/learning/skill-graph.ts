import type { Skill, SkillDependency, UUID } from "@/types/domain";

/**
 * Pure graph logic over the Skill Graph (skills + skill_dependencies — see
 * db/schema/003_languages_and_skills.sql). No I/O here: services/learning
 * loads rows from Supabase and passes them in, which keeps this testable
 * without a database.
 */

export interface SkillGraph {
  skills: Map<UUID, Skill>;
  /** skillId -> set of prerequisite skillIds */
  dependencies: Map<UUID, Set<UUID>>;
}

export function buildSkillGraph(skills: Skill[], dependencies: SkillDependency[]): SkillGraph {
  const skillMap = new Map(skills.map((skill) => [skill.id, skill]));
  const dependencyMap = new Map<UUID, Set<UUID>>();

  for (const skill of skills) {
    dependencyMap.set(skill.id, new Set());
  }
  for (const dep of dependencies) {
    dependencyMap.get(dep.skillId)?.add(dep.prerequisiteSkillId);
  }

  return { skills: skillMap, dependencies: dependencyMap };
}

export function getPrerequisites(graph: SkillGraph, skillId: UUID): Skill[] {
  const prereqIds = graph.dependencies.get(skillId) ?? new Set();
  return [...prereqIds].map((id) => graph.skills.get(id)).filter((s): s is Skill => Boolean(s));
}

export function getDependents(graph: SkillGraph, skillId: UUID): Skill[] {
  const dependents: Skill[] = [];
  for (const [id, prereqIds] of graph.dependencies) {
    if (prereqIds.has(skillId)) {
      const skill = graph.skills.get(id);
      if (skill) dependents.push(skill);
    }
  }
  return dependents;
}

/**
 * A skill is unlocked once every prerequisite is in `masteredSkillIds`.
 * A skill with no prerequisites is always unlocked.
 */
export function isSkillUnlocked(
  graph: SkillGraph,
  skillId: UUID,
  masteredSkillIds: Set<UUID>,
): boolean {
  const prereqIds = graph.dependencies.get(skillId);
  if (!prereqIds || prereqIds.size === 0) return true;
  return [...prereqIds].every((id) => masteredSkillIds.has(id));
}

export function getUnlockedSkills(graph: SkillGraph, masteredSkillIds: Set<UUID>): Skill[] {
  return [...graph.skills.values()].filter((skill) =>
    isSkillUnlocked(graph, skill.id, masteredSkillIds),
  );
}

/** Detects cycles via DFS — a healthy skill graph must be a DAG. */
export function detectCycle(graph: SkillGraph): UUID[] | null {
  const visiting = new Set<UUID>();
  const visited = new Set<UUID>();

  function visit(skillId: UUID, path: UUID[]): UUID[] | null {
    if (visiting.has(skillId)) return [...path, skillId];
    if (visited.has(skillId)) return null;

    visiting.add(skillId);
    for (const prereqId of graph.dependencies.get(skillId) ?? []) {
      const cycle = visit(prereqId, [...path, skillId]);
      if (cycle) return cycle;
    }
    visiting.delete(skillId);
    visited.add(skillId);
    return null;
  }

  for (const skillId of graph.skills.keys()) {
    const cycle = visit(skillId, []);
    if (cycle) return cycle;
  }
  return null;
}

/** Topological order — prerequisites always appear before dependents. */
export function topologicalOrder(graph: SkillGraph): Skill[] {
  const visited = new Set<UUID>();
  const order: Skill[] = [];

  function visit(skillId: UUID) {
    if (visited.has(skillId)) return;
    visited.add(skillId);
    for (const prereqId of graph.dependencies.get(skillId) ?? []) {
      visit(prereqId);
    }
    const skill = graph.skills.get(skillId);
    if (skill) order.push(skill);
  }

  for (const skillId of graph.skills.keys()) {
    visit(skillId);
  }
  return order;
}
