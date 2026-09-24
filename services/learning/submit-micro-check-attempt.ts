import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  submitMicroCheckAttemptSchema,
  type SubmitMicroCheckAttemptInput,
} from "@/lib/validation/schemas";
import { recordLearningEvent } from "./record-learning-event";

export interface MicroCheckAttemptResult {
  isCorrect: boolean;
  explanation: string;
}

/**
 * Grades a micro-check attempt server-side (never trust a client-reported
 * "isCorrect") and records it. Correctness is computed by comparing against
 * `micro_checks.correct_answer`, not something the client asserts.
 */
export async function submitMicroCheckAttempt(
  supabase: SupabaseClient,
  userId: string,
  input: SubmitMicroCheckAttemptInput,
): Promise<MicroCheckAttemptResult> {
  const parsed = submitMicroCheckAttemptSchema.parse(input);

  const { data: microCheck, error } = await supabase
    .from("micro_checks")
    .select("id, lesson_id, correct_answer, explanation")
    .eq("id", parsed.microCheckId)
    .single();

  if (error || !microCheck) {
    throw new Error("Micro check not found.");
  }

  const isCorrect =
    normalizeAnswer(parsed.selectedAnswer) === normalizeAnswer(microCheck.correct_answer);

  const { error: insertError } = await supabase.from("user_micro_check_attempts").insert({
    user_id: userId,
    micro_check_id: parsed.microCheckId,
    selected_answer: parsed.selectedAnswer,
    is_correct: isCorrect,
  });

  if (insertError) {
    throw new Error(`Failed to record micro check attempt: ${insertError.message}`);
  }

  await recordLearningEvent(supabase, userId, {
    eventType: "micro_check_completed",
    lessonId: microCheck.lesson_id,
    metadata: { microCheckId: parsed.microCheckId, isCorrect },
  });

  return { isCorrect, explanation: microCheck.explanation };
}

function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase();
}
