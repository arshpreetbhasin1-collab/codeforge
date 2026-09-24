import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { getProjectWorkspaceData } from "@/services/projects/get-workspace-data";
import { ProjectWorkspaceView } from "@/components/projects/project-workspace-view";

interface WorkspacePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ stage?: string }>;
}

export async function generateMetadata({ params }: WorkspacePageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Workspace — ${slug} — CodeForge` };
}

export default async function WorkspacePage({ params, searchParams }: WorkspacePageProps) {
  const { slug } = await params;
  const { stage } = await searchParams;
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect(`/login?next=${encodeURIComponent(`/projects/${slug}/workspace`)}`);
  }

  const supabase = await createSupabaseServerClient();
  const data = await getProjectWorkspaceData(supabase, profile.id, slug, stage ?? null);

  if (!data) notFound();

  return <ProjectWorkspaceView data={data} />;
}
