import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { getLessonDetail } from "@/services/learning/get-lesson-detail";
import { LessonView } from "@/components/learning/lesson-view";

interface LessonPageProps {
  params: Promise<{ module: string; lesson: string }>;
}

export async function generateMetadata({ params }: LessonPageProps): Promise<Metadata> {
  const { module: moduleSlug, lesson: lessonSlug } = await params;
  const supabase = await createSupabaseServerClient();
  const lesson = await getLessonDetail(supabase, null, moduleSlug, lessonSlug);
  return { title: lesson ? `${lesson.title} — CodeForge` : "Lesson — CodeForge" };
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { module: moduleSlug, lesson: lessonSlug } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createSupabaseServerClient();
  const lesson = await getLessonDetail(supabase, profile?.id ?? null, moduleSlug, lessonSlug);

  if (!lesson) notFound();

  return <LessonView lesson={lesson} isAuthenticated={Boolean(profile)} />;
}
