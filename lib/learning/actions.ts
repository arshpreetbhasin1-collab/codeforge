"use server";

import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { recordLessonProgress } from "@/services/learning/record-lesson-progress";
import { recordProblemProgress } from "@/services/learning/record-problem-progress";
import { recordLearningEvent } from "@/services/learning/record-learning-event";
import {
  submitMicroCheckAttempt,
  type MicroCheckAttemptResult,
} from "@/services/learning/submit-micro-check-attempt";

/**
 * Server Actions the (app) client components call. Each one derives the
 * authenticated user server-side (never trusts a client-supplied user id —
 * see SECURITY) and delegates to services/learning for the actual write.
 */

async function requireUserId(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not authenticated.");
  }
  return user.id;
}

export async function markLessonStarted(lessonId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const userId = await requireUserId();
  await recordLessonProgress(supabase, userId, lessonId, "in_progress");
}

export async function markLessonCompleted(lessonId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const userId = await requireUserId();
  await recordLessonProgress(supabase, userId, lessonId, "completed");
}

export async function submitMicroCheck(
  microCheckId: string,
  selectedAnswer: string,
): Promise<MicroCheckAttemptResult> {
  const supabase = await createSupabaseServerClient();
  const userId = await requireUserId();
  return submitMicroCheckAttempt(supabase, userId, { microCheckId, selectedAnswer });
}

export async function markProblemStarted(problemId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const userId = await requireUserId();
  await recordLearningEvent(supabase, userId, { eventType: "problem_started", problemId, metadata: {} });
}

/**
 * Called when a student clicks Run/Submit on a problem. Execution itself
 * doesn't exist yet (Prompt 3) — this only records that they tried, via
 * `attempted` status. It can never mark a problem `completed`; that
 * requires a real passing submission, which this prompt does not fake.
 */
export async function markProblemAttempted(problemId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const userId = await requireUserId();
  await recordProblemProgress(supabase, userId, problemId, "attempted");
}

export async function requestHintEvent(problemId: string, hintLevel: number): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const userId = await requireUserId();
  await recordLearningEvent(supabase, userId, {
    eventType: "hint_requested",
    problemId,
    metadata: { hintLevel },
  });
}
