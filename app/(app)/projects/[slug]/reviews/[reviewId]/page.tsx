import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { getProjectReview } from "@/services/projects/get-project-review";
import { ProjectReviewView } from "@/components/projects/project-review-view";

interface ReviewPageProps {
  params: Promise<{ slug: string; reviewId: string }>;
}

export const metadata: Metadata = { title: "Project Review — CodeForge" };

export default async function ProjectReviewPage({ params }: ReviewPageProps) {
  const { slug, reviewId } = await params;
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect(`/login?next=${encodeURIComponent(`/projects/${slug}/reviews/${reviewId}`)}`);
  }

  const supabase = await createSupabaseServerClient();
  const review = await getProjectReview(supabase, profile.id, reviewId);

  if (!review || review.projectSlug !== slug) notFound();

  return <ProjectReviewView review={review} />;
}
