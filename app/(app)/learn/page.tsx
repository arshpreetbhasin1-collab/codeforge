import type { Metadata } from "next";
import Link from "next/link";
import { Check, Circle, ArrowRight, Clock } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { getLearnOverview } from "@/services/learning/get-learn-overview";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Learn — CodeForge" };

export default async function LearnPage() {
  const profile = await getCurrentProfile();
  const supabase = await createSupabaseServerClient();
  const overview = await getLearnOverview(supabase, profile?.id ?? null);

  if (!overview.curriculum) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Learn</h1>
        <p className="max-w-lg text-muted-foreground">
          No curriculum is seeded yet. Run <code className="font-mono text-sm">db/seed/seed.sql</code>{" "}
          against a connected Supabase project to populate one.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{overview.curriculum.title}</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">{overview.curriculum.description}</p>
      </div>

      <Card className="border-brand/30 bg-brand/5">
        <CardContent className="flex flex-col gap-4 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-muted-foreground">Your progress</span>
              <span className="font-medium">{overview.progressPercent}%</span>
            </div>
            <Progress value={overview.progressPercent} className="mt-2" />
            <p className="mt-2 text-sm text-muted-foreground">
              {overview.completedLessons} of {overview.totalLessons} lessons complete
            </p>
          </div>
          {overview.nextLesson && (
            <Button asChild size="lg" className="shrink-0">
              <Link href={`/learn/${overview.nextLesson.moduleSlug}/${overview.nextLesson.lessonSlug}`}>
                Continue: {overview.nextLesson.title}
                <ArrowRight />
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6">
        {overview.modules.map((module) => (
          <div key={module.id}>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-base font-semibold">{module.title}</h2>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" />
                {module.estimatedMinutes} min
              </span>
            </div>
            <div className="flex flex-col divide-y rounded-lg border">
              {module.lessons.length === 0 && (
                <p className="px-4 py-3 text-sm text-muted-foreground">No lessons published yet.</p>
              )}
              {module.lessons.map((lesson) => {
                const isNext =
                  overview.nextLesson?.lessonSlug === lesson.slug &&
                  overview.nextLesson?.moduleSlug === module.slug;
                return (
                  <Link
                    key={lesson.id}
                    href={`/learn/${module.slug}/${lesson.slug}`}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted",
                      isNext && "bg-muted",
                    )}
                  >
                    <LessonStatusIcon status={lesson.status} isNext={isNext} />
                    <span className={cn("flex-1", lesson.status === "completed" && "text-muted-foreground")}>
                      {lesson.title}
                    </span>
                    {isNext && (
                      <Badge variant="secondary" className="text-xs">
                        Up next
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LessonStatusIcon({
  status,
  isNext,
}: {
  status: "not_started" | "in_progress" | "completed";
  isNext: boolean;
}) {
  if (status === "completed") {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
        <Check className="size-3" strokeWidth={3} />
      </span>
    );
  }
  if (isNext) {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-brand text-brand">
        <ArrowRight className="size-3" strokeWidth={3} />
      </span>
    );
  }
  return <Circle className="size-5 shrink-0 text-muted-foreground/40" strokeWidth={2} />;
}
