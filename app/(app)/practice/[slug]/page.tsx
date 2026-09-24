import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { getProblemDetail } from "@/services/learning/get-problem-detail";
import { ProblemView } from "@/components/problems/problem-view";

interface ProblemPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProblemPageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const problem = await getProblemDetail(supabase, null, slug);
  return { title: problem ? `${problem.title} — CodeForge` : "Problem — CodeForge" };
}

export default async function ProblemPage({ params }: ProblemPageProps) {
  const { slug } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createSupabaseServerClient();
  const problem = await getProblemDetail(supabase, profile?.id ?? null, slug);

  if (!problem) notFound();

  return <ProblemView problem={problem} isAuthenticated={Boolean(profile)} />;
}
