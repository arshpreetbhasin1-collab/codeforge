import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateProjectReadiness } from "./get-project-readiness";
import { recordLearningEvent } from "@/services/learning/record-learning-event";

export interface StartProjectResult {
  firstStageSlug: string | null;
}

/**
 * Begins (or resumes) a project — see SUBMISSION FLOW: "validate state ->
 * validate code -> ..." starts here, before any code exists. Readiness is
 * re-checked against real skill_mastery server-side; a locked project can
 * never be started just because a client sent the request — see
 * SECURITY: "never trust any client-supplied ... completion-state."
 * Idempotent: calling this again for an already-started project is a
 * no-op that just returns the current first stage, so "Continue Building"
 * can safely call the same action as "Start Project."
 */
export async function startProject(supabase: SupabaseClient, userId: string, projectId: string): Promise<StartProjectResult> {
  const { data: project } = await supabase.from("projects").select("id").eq("id", projectId).eq("is_published", true).maybeSingle();
  if (!project) {
    throw new Error("This project doesn't exist or isn't published.");
  }

  const { data: stages } = await supabase.from("project_stages").select("id, slug").eq("project_id", projectId).order("sort_order", { ascending: true });
  const firstStage = (stages ?? [])[0] ?? null;

  const { data: existingProgress } = await supabase
    .from("user_project_progress")
    .select("id, verdict")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (existingProgress) {
    return { firstStageSlug: firstStage?.slug ?? null };
  }

  const readiness = await calculateProjectReadiness(supabase, userId, projectId);
  if (!readiness || !readiness.isReady) {
    throw new Error(readiness?.explanation ?? "This project isn't unlocked yet.");
  }

  const now = new Date().toISOString();

  const { error: progressError } = await supabase.from("user_project_progress").insert({
    user_id: userId,
    project_id: projectId,
    verdict: "in_progress",
    current_stage_id: firstStage?.id ?? null,
    started_at: now,
  });
  if (progressError) {
    throw new Error(`Failed to start project: ${progressError.message}`);
  }

  if (firstStage) {
    await supabase.from("project_stage_progress").upsert(
      {
        user_id: userId,
        project_id: projectId,
        stage_id: firstStage.id,
        status: "in_progress",
        started_at: now,
      },
      { onConflict: "user_id,stage_id" },
    );
  }

  await recordLearningEvent(supabase, userId, { eventType: "project_started", projectId, metadata: {} });
  if (firstStage) {
    await recordLearningEvent(supabase, userId, { eventType: "project_stage_started", projectId, metadata: { stageId: firstStage.id } });
  }

  return { firstStageSlug: firstStage?.slug ?? null };
}
