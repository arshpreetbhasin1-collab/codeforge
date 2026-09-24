import { describe, expect, it } from "vitest";
import { formatEntry, groupByDay, type RawEvent, type ProgressHistoryEntry } from "@/services/learner/get-progress-history";

const NOW = new Date("2026-06-10T12:00:00Z");

function rawEvent(overrides: Partial<RawEvent> = {}): RawEvent {
  return {
    id: "evt-1",
    event_type: "problem_completed",
    skill_id: null,
    problem_id: null,
    lesson_id: null,
    metadata: {},
    created_at: NOW.toISOString(),
    ...overrides,
  };
}

describe("formatEntry — real event -> human label, never fabricated", () => {
  it("names the actual problem for problem_completed", () => {
    const entry = formatEntry(
      rawEvent({ event_type: "problem_completed", problem_id: "p1" }),
      new Map(),
      new Map([["p1", "Binary Search"]]),
      new Map(),
    );
    expect(entry.label).toBe("Solved: Binary Search");
  });

  it("names the actual lesson for lesson_completed", () => {
    const entry = formatEntry(
      rawEvent({ event_type: "lesson_completed", lesson_id: "l1" }),
      new Map(),
      new Map(),
      new Map([["l1", "Naming a Value"]]),
    );
    expect(entry.label).toBe("Completed lesson: Naming a Value");
  });

  it("shows the real previous -> new mastery score for skill_mastery_updated", () => {
    const entry = formatEntry(
      rawEvent({ event_type: "skill_mastery_updated", skill_id: "s1", metadata: { previousScore: 68, newScore: 74 } }),
      new Map([["s1", "Arrays"]]),
      new Map(),
      new Map(),
    );
    expect(entry.label).toBe("Arrays mastery updated");
    expect(entry.detail).toBe("68 → 74");
  });

  it("shows just the new score with no previous value fabricated when there was none", () => {
    const entry = formatEntry(
      rawEvent({ event_type: "skill_mastery_updated", skill_id: "s1", metadata: { previousScore: null, newScore: 40 } }),
      new Map([["s1", "Arrays"]]),
      new Map(),
      new Map(),
    );
    expect(entry.detail).toBe("40/100");
  });

  it("names the problem for a mistake event when available", () => {
    const entry = formatEntry(
      rawEvent({ event_type: "logic_mistake", problem_id: "p1" }),
      new Map(),
      new Map([["p1", "Two Sum"]]),
      new Map(),
    );
    expect(entry.label).toBe("Logic mistake on Two Sum");
  });
});

describe("groupByDay — real chronology, no fabricated dates", () => {
  it("labels today's entries as Today", () => {
    const entries: ProgressHistoryEntry[] = [
      { id: "1", eventType: "problem_completed", label: "Solved: X", detail: null, occurredAt: NOW.toISOString() },
    ];
    const days = groupByDay(entries, NOW);
    expect(days[0].dayLabel).toBe("Today");
    expect(days[0].entries).toHaveLength(1);
  });

  it("labels yesterday's entries as Yesterday and groups by real date", () => {
    const yesterday = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
    const entries: ProgressHistoryEntry[] = [
      { id: "1", eventType: "problem_completed", label: "Solved: X", detail: null, occurredAt: NOW.toISOString() },
      { id: "2", eventType: "lesson_completed", label: "Completed: Y", detail: null, occurredAt: yesterday.toISOString() },
    ];
    const days = groupByDay(entries, NOW);
    expect(days).toHaveLength(2);
    expect(days[0].dayLabel).toBe("Today");
    expect(days[1].dayLabel).toBe("Yesterday");
  });

  it("orders days most recent first", () => {
    const twoDaysAgo = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000);
    const entries: ProgressHistoryEntry[] = [
      { id: "1", eventType: "problem_completed", label: "A", detail: null, occurredAt: twoDaysAgo.toISOString() },
      { id: "2", eventType: "problem_completed", label: "B", detail: null, occurredAt: NOW.toISOString() },
    ];
    const days = groupByDay(entries, NOW);
    expect(days[0].dayLabel).toBe("Today");
    expect(days[1].entries[0].label).toBe("A");
  });

  it("returns an empty array for no entries — never fabricates a placeholder day", () => {
    expect(groupByDay([], NOW)).toEqual([]);
  });
});
