import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createFakeSupabase } from "./helpers/fake-supabase";
import { recordProblemProgress } from "@/services/learning/record-problem-progress";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PROBLEM_ID = "33333333-3333-4333-8333-333333333333";

function fakeClient() {
  return createFakeSupabase() as unknown as SupabaseClient;
}

function progressRows(supabase: SupabaseClient) {
  return (supabase as unknown as { _tables: Map<string, Record<string, unknown>[]> })._tables.get(
    "user_problem_progress",
  );
}

describe("recordProblemProgress", () => {
  it("creates a new attempted row with attempts_count 1", async () => {
    const supabase = fakeClient();
    await recordProblemProgress(supabase, USER_ID, PROBLEM_ID, "attempted");

    const rows = progressRows(supabase);
    expect(rows).toHaveLength(1);
    expect(rows?.[0]).toMatchObject({ status: "attempted", attempts_count: 1 });
  });

  it("increments attempts_count on repeated attempts", async () => {
    const supabase = fakeClient();
    await recordProblemProgress(supabase, USER_ID, PROBLEM_ID, "attempted");
    await recordProblemProgress(supabase, USER_ID, PROBLEM_ID, "attempted");
    await recordProblemProgress(supabase, USER_ID, PROBLEM_ID, "attempted");

    const rows = progressRows(supabase);
    expect(rows).toHaveLength(1);
    expect(rows?.[0].attempts_count).toBe(3);
  });

  it("never fabricates a completed status without an explicit completed call — this test documents that attempted alone cannot flip status", async () => {
    const supabase = fakeClient();
    await recordProblemProgress(supabase, USER_ID, PROBLEM_ID, "attempted");
    await recordProblemProgress(supabase, USER_ID, PROBLEM_ID, "attempted");

    const rows = progressRows(supabase);
    expect(rows?.[0].status).toBe("attempted");
  });

  it("marks completed and preserves the original completed_at on further attempts", async () => {
    const supabase = fakeClient();
    await recordProblemProgress(supabase, USER_ID, PROBLEM_ID, "completed");
    const rows = progressRows(supabase);
    const firstCompletedAt = rows?.[0].completed_at;

    await recordProblemProgress(supabase, USER_ID, PROBLEM_ID, "attempted");

    expect(rows?.[0].status).toBe("completed");
    expect(rows?.[0].completed_at).toBe(firstCompletedAt);
    expect(rows?.[0].attempts_count).toBe(2);
  });

  it("records a problem_attempted learning event, not problem_completed, for an attempt", async () => {
    const supabase = fakeClient();
    await recordProblemProgress(supabase, USER_ID, PROBLEM_ID, "attempted");

    const events = (supabase as unknown as { _tables: Map<string, Record<string, unknown>[]> })._tables.get(
      "learning_events",
    );
    expect(events?.[0]).toMatchObject({ event_type: "problem_attempted", problem_id: PROBLEM_ID });
  });
});
