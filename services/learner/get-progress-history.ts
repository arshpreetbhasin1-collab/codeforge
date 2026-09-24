import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LearningEventType } from "@/types/domain";

export interface ProgressHistoryEntry {
  id: string;
  eventType: LearningEventType;
  label: string;
  detail: string | null;
  occurredAt: string;
}

export interface ProgressHistoryDay {
  /** YYYY-MM-DD in the event's own UTC date — grouping key. */
  date: string;
  /** "Today" / "Yesterday" / a formatted date — computed relative to `now`. */
  dayLabel: string;
  entries: ProgressHistoryEntry[];
}

/**
 * The event types that belong on a learner-facing timeline — see PHASE
 * 13: real completions, mastery changes, and mistakes, not every
 * internal micro-event (a `lesson_viewed` or `problem_started` isn't
 * something worth showing as "progress"). Nothing here is fabricated;
 * this is a curated SELECT over real learning_events rows.
 */
const TIMELINE_EVENT_TYPES: readonly LearningEventType[] = [
  "lesson_completed",
  "micro_check_completed",
  "problem_completed",
  "boss_completed",
  "project_completed",
  "interview_completed",
  "skill_mastery_updated",
  "compilation_mistake",
  "runtime_mistake",
  "logic_mistake",
  "efficiency_mistake",
];

const HISTORY_LIMIT = 100;

export async function getProgressHistory(supabase: SupabaseClient, userId: string, now: Date = new Date()): Promise<ProgressHistoryDay[]> {
  const { data: events, error } = await supabase
    .from("learning_events")
    .select("id, event_type, skill_id, problem_id, lesson_id, metadata, created_at")
    .eq("user_id", userId)
    .in("event_type", TIMELINE_EVENT_TYPES)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  if (error) throw new Error(`Failed to load learning events: ${error.message}`);
  if (!events || events.length === 0) return [];

  const skillIds = [...new Set(events.map((e) => e.skill_id).filter((id): id is string => Boolean(id)))];
  const problemIds = [...new Set(events.map((e) => e.problem_id).filter((id): id is string => Boolean(id)))];
  const lessonIds = [...new Set(events.map((e) => e.lesson_id).filter((id): id is string => Boolean(id)))];

  const [{ data: skills }, { data: problems }, { data: lessons }] = await Promise.all([
    skillIds.length ? supabase.from("skills").select("id, name").in("id", skillIds) : Promise.resolve({ data: [] }),
    problemIds.length ? supabase.from("problems").select("id, title").in("id", problemIds) : Promise.resolve({ data: [] }),
    lessonIds.length ? supabase.from("lessons").select("id, title").in("id", lessonIds) : Promise.resolve({ data: [] }),
  ]);

  const skillNameById = new Map((skills ?? []).map((s) => [s.id as string, s.name as string]));
  const problemTitleById = new Map((problems ?? []).map((p) => [p.id as string, p.title as string]));
  const lessonTitleById = new Map((lessons ?? []).map((l) => [l.id as string, l.title as string]));

  const entries: ProgressHistoryEntry[] = events.map((e) =>
    formatEntry(e, skillNameById, problemTitleById, lessonTitleById),
  );

  return groupByDay(entries, now);
}

export interface RawEvent {
  id: string;
  event_type: LearningEventType;
  skill_id: string | null;
  problem_id: string | null;
  lesson_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function formatEntry(
  e: RawEvent,
  skillNameById: Map<string, string>,
  problemTitleById: Map<string, string>,
  lessonTitleById: Map<string, string>,
): ProgressHistoryEntry {
  const skillName = e.skill_id ? skillNameById.get(e.skill_id) : undefined;
  const problemTitle = e.problem_id ? problemTitleById.get(e.problem_id) : undefined;
  const lessonTitle = e.lesson_id ? lessonTitleById.get(e.lesson_id) : undefined;

  let label: string;
  let detail: string | null = null;

  switch (e.event_type) {
    case "lesson_completed":
      label = `Completed lesson: ${lessonTitle ?? "Unknown lesson"}`;
      break;
    case "micro_check_completed":
      label = `Completed a micro-check${lessonTitle ? ` in ${lessonTitle}` : ""}`;
      break;
    case "problem_completed":
      label = `Solved: ${problemTitle ?? "Unknown problem"}`;
      break;
    case "boss_completed":
      label = `Completed boss challenge: ${problemTitle ?? "Unknown problem"}`;
      break;
    case "project_completed":
      label = "Completed a project";
      break;
    case "interview_completed":
      label = "Completed a mock interview";
      break;
    case "skill_mastery_updated": {
      const previous = e.metadata.previousScore as number | null;
      const next = e.metadata.newScore as number;
      label = `${skillName ?? "Skill"} mastery updated`;
      detail = previous === null ? `${next}/100` : `${previous} → ${next}`;
      break;
    }
    case "compilation_mistake":
      label = `Compilation mistake${problemTitle ? ` on ${problemTitle}` : ""}`;
      break;
    case "runtime_mistake":
      label = `Runtime mistake${problemTitle ? ` on ${problemTitle}` : ""}`;
      break;
    case "logic_mistake":
      label = `Logic mistake${problemTitle ? ` on ${problemTitle}` : ""}`;
      break;
    case "efficiency_mistake":
      label = `Efficiency mistake${problemTitle ? ` on ${problemTitle}` : ""}`;
      break;
    default:
      label = e.event_type;
  }

  return { id: e.id, eventType: e.event_type, label, detail, occurredAt: e.created_at };
}

export function groupByDay(entries: ProgressHistoryEntry[], now: Date): ProgressHistoryDay[] {
  const todayKey = dateKey(now);
  const yesterdayKey = dateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));

  const byDate = new Map<string, ProgressHistoryEntry[]>();
  for (const entry of entries) {
    const key = dateKey(new Date(entry.occurredAt));
    const list = byDate.get(key) ?? [];
    list.push(entry);
    byDate.set(key, list);
  }

  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, dayEntries]) => ({
      date,
      dayLabel: date === todayKey ? "Today" : date === yesterdayKey ? "Yesterday" : formatDateLabel(date),
      entries: dayEntries,
    }));
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(dateKeyStr: string): string {
  const date = new Date(`${dateKeyStr}T00:00:00Z`);
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}
