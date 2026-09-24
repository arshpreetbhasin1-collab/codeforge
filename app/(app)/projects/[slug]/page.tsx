import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { getProjectDetail } from "@/services/projects/get-project-detail";
import { ProjectDetailView } from "@/components/projects/project-detail-view";

interface ProjectDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProjectDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const project = await getProjectDetail(supabase, null, slug);
  return { title: project ? `${project.title} — CodeForge` : "Project — CodeForge" };
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { slug } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createSupabaseServerClient();
  const project = await getProjectDetail(supabase, profile?.id ?? null, slug);

  if (!project) notFound();

  return <ProjectDetailView project={project} isAuthenticated={Boolean(profile)} />;
}
