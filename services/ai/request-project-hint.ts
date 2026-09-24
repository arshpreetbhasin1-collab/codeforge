import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProjectCoachContext } from "./get-project-coach-context";
import { requestProjectHint, type ProjectHintLevel } from "@/lib/ai/capabilities";
import { recordLearningEvent } from "@/services/learning/record-learning-event";
import { projectHintRequestSchema, type ProjectHintRequestInput } from "@/lib/validation/schemas";

export interface ProjectHintResult {
  content: string;
  level: ProjectHintLevel;
}

/**
 * The single entry point the workspace's "Ask AI Coach" UI calls — see AI
 * PROJECT COACH. Assembles a restricted context (never unrestricted DB
 * access), asks the AI provider for exactly one hint level, and persists
 * the exchange to ai_conversations/ai_messages for hint-usage tracking.
 * Never mutates project_submissions/user_project_progress — a coach
 * conversation cannot advance or grade anything.
 *
 * If no AI provider is configured (see lib/ai/provider.ts), this throws
 * rather than fabricating a response — see NO FAKE FUNCTIONALITY: "show
 * an honest 'unavailable' state for anything not implemented." Nothing
 * is written to ai_conversations/ai_messages on failure.
 */
export async function requestProjectHintForStage(supabase: SupabaseClient, userId: string, input: ProjectHintRequestInput): Promise<ProjectHintResult> {
  const params = projectHintRequestSchema.parse(input);
  const context = await getProjectCoachContext(supabase, userId, params);
  if (!context) {
    throw new Error("This project stage doesn't exist.");
  }

  const completion = await requestProjectHint({ context, level: params.level, question: params.question });

  const { data: conversation } = await supabase
    .from("ai_conversations")
    .select("id")
    .eq("user_id", userId)
    .eq("capability", "hint")
    .eq("project_id", params.projectId)
    .maybeSingle();

  const conversationId =
    conversation?.id ??
    (
      await supabase
        .from("ai_conversations")
        .insert({ user_id: userId, capability: "hint", project_id: params.projectId })
        .select("id")
        .single()
    ).data?.id;

  if (conversationId) {
    await supabase.from("ai_messages").insert([
      { conversation_id: conversationId, role: "user", content: params.question },
      {
        conversation_id: conversationId,
        role: "assistant",
        content: completion.content,
        hint_level: params.level,
        provider: completion.provider,
        model: completion.model,
      },
    ]);
  }

  await recordLearningEvent(supabase, userId, {
    eventType: "hint_requested",
    projectId: params.projectId,
    metadata: { stageId: params.stageId, hintLevel: params.level },
  });

  return { content: completion.content, level: params.level };
}

/** Distinct hint levels this learner has already revealed for this project — mirrors submit-code.ts's countHintsUsed for problems. */
export async function countProjectHintsUsed(supabase: SupabaseClient, userId: string, projectId: string): Promise<number> {
  const { data } = await supabase.from("learning_events").select("metadata").eq("user_id", userId).eq("project_id", projectId).eq("event_type", "hint_requested");

  const levels = new Set((data ?? []).map((row) => (row.metadata as { hintLevel?: number })?.hintLevel).filter((level) => level !== undefined));
  return levels.size;
}
