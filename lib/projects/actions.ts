"use server";

import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { startProject, type StartProjectResult } from "@/services/projects/start-project";
import { runProjectStage, type RunProjectStageResult } from "@/services/execution/run-project-stage";
import { submitProjectStage, type SubmitProjectStageResult } from "@/services/projects/submit-project-stage";
import { requestProjectHintForStage, type ProjectHintResult } from "@/services/ai/request-project-hint";
import type { ProjectStageRunInput, ProjectStageSubmissionInput, ProjectHintRequestInput } from "@/lib/validation/schemas";

/**
 * Server Actions the project brief/workspace pages call. Every one derives
 * the authenticated user server-side — see AUTHORIZATION: "Never trust
 * user_id from the request body."
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

export async function startProjectAction(projectId: string): Promise<StartProjectResult> {
  const supabase = await createSupabaseServerClient();
  const userId = await requireUserId();
  return startProject(supabase, userId, projectId);
}

export async function runProjectStageAction(input: ProjectStageRunInput): Promise<RunProjectStageResult> {
  const supabase = await createSupabaseServerClient();
  const userId = await requireUserId();
  return runProjectStage(supabase, userId, input);
}

export async function submitProjectStageAction(input: ProjectStageSubmissionInput): Promise<SubmitProjectStageResult> {
  const supabase = await createSupabaseServerClient();
  const userId = await requireUserId();
  return submitProjectStage(supabase, userId, input);
}

export async function requestProjectHintAction(input: ProjectHintRequestInput): Promise<ProjectHintResult> {
  const supabase = await createSupabaseServerClient();
  const userId = await requireUserId();
  return requestProjectHintForStage(supabase, userId, input);
}
