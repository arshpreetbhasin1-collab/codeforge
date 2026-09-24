import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createFakeSupabase } from "./helpers/fake-supabase";
import { recordLessonProgress } from "@/services/learning/record-lesson-progress";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const LESSON_ID = "22222222-2222-4222-8222-222222222222";

function fakeClient() {
  return createFakeSupabase() as unknown as SupabaseClient;
}

describe("recordLessonProgress", () => {
  it("creates a new in_progress row on first call", async () => {
    const supabase = fakeClient();
    await recordLessonProgress(supabase, USER_ID, LESSON_ID, "in_progress");

    const rows = (supabase as unknown as { _tables: Map<string, Record<string, unknown>[]> })._tables.get(
      "user_lesson_progress",
    );
    expect(rows).toHaveLength(1);
    expect(rows?.[0]).toMatchObject({ user_id: USER_ID, lesson_id: LESSON_ID, status: "in_progress" });
  });

  it("marks a lesson completed and sets completed_at", async () => {
    const supabase = fakeClient();
    await recordLessonProgress(supabase, USER_ID, LESSON_ID, "in_progress");
    await recordLessonProgress(supabase, USER_ID, LESSON_ID, "completed");

    const rows = (supabase as unknown as { _tables: Map<string, Record<string, unknown>[]> })._tables.get(
      "user_lesson_progress",
    );
    expect(rows).toHaveLength(1);
    expect(rows?.[0].status).toBe("completed");
    expect(rows?.[0].completed_at).not.toBeNull();
  });

  it("never regresses a completed lesson back to in_progress", async () => {
    const supabase = fakeClient();
    await recordLessonProgress(supabase, USER_ID, LESSON_ID, "completed");
    await recordLessonProgress(supabase, USER_ID, LESSON_ID, "in_progress");

    const rows = (supabase as unknown as { _tables: Map<string, Record<string, unknown>[]> })._tables.get(
      "user_lesson_progress",
    );
    expect(rows?.[0].status).toBe("completed");
  });

  it("records a matching learning_events row", async () => {
    const supabase = fakeClient();
    await recordLessonProgress(supabase, USER_ID, LESSON_ID, "completed");

    const events = (supabase as unknown as { _tables: Map<string, Record<string, unknown>[]> })._tables.get(
      "learning_events",
    );
    expect(events).toHaveLength(1);
    expect(events?.[0]).toMatchObject({ event_type: "lesson_completed", lesson_id: LESSON_ID });
  });

  it("rejects an invalid lesson id", async () => {
    const supabase = fakeClient();
    await expect(recordLessonProgress(supabase, USER_ID, "not-a-uuid", "in_progress")).rejects.toThrow();
  });
});
