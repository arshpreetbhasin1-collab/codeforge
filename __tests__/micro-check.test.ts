import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createFakeSupabase } from "./helpers/fake-supabase";
import { submitMicroCheckAttempt } from "@/services/learning/submit-micro-check-attempt";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CHECK_ID = "44444444-4444-4444-8444-444444444444";
const LESSON_ID = "55555555-5555-4555-8555-555555555555";

function fakeClientWithCheck() {
  const supabase = createFakeSupabase();
  supabase._tables.set("micro_checks", [
    {
      id: CHECK_ID,
      lesson_id: LESSON_ID,
      correct_answer: "b",
      explanation: "b is correct because...",
    },
  ]);
  return supabase as unknown as SupabaseClient;
}

describe("submitMicroCheckAttempt", () => {
  it("grades correctness server-side by comparing to the stored answer, not trusting the client", async () => {
    const supabase = fakeClientWithCheck();
    const correct = await submitMicroCheckAttempt(supabase, USER_ID, {
      microCheckId: CHECK_ID,
      selectedAnswer: "b",
    });
    expect(correct.isCorrect).toBe(true);

    const incorrect = await submitMicroCheckAttempt(supabase, USER_ID, {
      microCheckId: CHECK_ID,
      selectedAnswer: "a",
    });
    expect(incorrect.isCorrect).toBe(false);
  });

  it("normalizes case and whitespace before comparing", async () => {
    const supabase = fakeClientWithCheck();
    const result = await submitMicroCheckAttempt(supabase, USER_ID, {
      microCheckId: CHECK_ID,
      selectedAnswer: "  B  ",
    });
    expect(result.isCorrect).toBe(true);
  });

  it("records the attempt with the server-computed correctness", async () => {
    const supabase = fakeClientWithCheck();
    await submitMicroCheckAttempt(supabase, USER_ID, { microCheckId: CHECK_ID, selectedAnswer: "a" });

    const attempts = (supabase as unknown as { _tables: Map<string, Record<string, unknown>[]> })._tables.get(
      "user_micro_check_attempts",
    );
    expect(attempts?.[0]).toMatchObject({ user_id: USER_ID, is_correct: false });
  });

  it("throws for a micro check that does not exist", async () => {
    const supabase = createFakeSupabase() as unknown as SupabaseClient;
    await expect(
      submitMicroCheckAttempt(supabase, USER_ID, { microCheckId: CHECK_ID, selectedAnswer: "a" }),
    ).rejects.toThrow();
  });
});
