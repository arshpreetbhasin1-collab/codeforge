import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { getLearnOverview } from "@/services/learning/get-learn-overview";
import { getLearnerProfile } from "@/services/learner/get-learner-profile";
import { getDashboardStats } from "@/services/learner/get-dashboard-stats";
import { getReviewQueue } from "@/services/learner/get-review-queue";
import { getProgressHistory } from "@/services/learner/get-progress-history";
import { getDashboardProjectCards } from "@/services/projects/get-dashboard-project-cards";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { NextBestStepCard } from "@/components/learning/next-best-step-card";
import { ArrowRight, Flame, GraduationCap, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = { title: "Home — CodeForge" };

function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function HomePage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to CodeForge</h1>
        <p className="text-muted-foreground">Sign in to see your personalized dashboard.</p>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const now = new Date();

  const [overview, learnerProfile, stats, reviewQueue, progressHistory, projectCards] = await Promise.all([
    getLearnOverview(supabase, profile.id),
    getLearnerProfile(supabase, profile.id, now),
    getDashboardStats(supabase, profile.id, now),
    getReviewQueue(supabase, profile.id, now),
    getProgressHistory(supabase, profile.id, now),
    getDashboardProjectCards(supabase, profile.id),
  ]);

  const topMistakePattern = learnerProfile.mistakeProfile.topPatterns[0] ?? null;
  const recentEntries = progressHistory[0]?.entries.slice(0, 3) ?? [];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting(now)}{profile.displayName ? `, ${profile.displayName}` : ""}.
        </h1>
        <p className="mt-1 text-muted-foreground">Here&apos;s what to focus on today.</p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Your next best step</h2>
        <NextBestStepCard recommendation={learnerProfile.nextBestAction} href={learnerProfile.nextBestActionHref} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Your progress</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard icon={Flame} label="Current streak" value={stats.currentStreak > 0 ? `${stats.currentStreak} day${stats.currentStreak > 1 ? "s" : ""}` : "—"} />
          <StatCard icon={GraduationCap} label="Skills mastered" value={String(stats.skillsMastered)} />
          <StatCard icon={CheckCircle2} label="Problems solved" value={String(stats.problemsSolved)} />
        </div>
      </section>

      {(projectCards.current || projectCards.recommended) && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Projects</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {projectCards.current && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">Current project</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <p className="font-semibold">{projectCards.current.projectTitle}</p>
                  {projectCards.current.currentStageTitle && (
                    <p className="text-sm text-muted-foreground">
                      Stage {projectCards.current.completedStages + 1}/{projectCards.current.totalStages}: {projectCards.current.currentStageTitle}
                    </p>
                  )}
                  <Progress value={projectCards.current.percentComplete} className="h-1.5" />
                  <Button asChild size="sm" className="w-fit">
                    <Link href={`/projects/${projectCards.current.projectSlug}/workspace`}>
                      Continue building
                      <ArrowRight />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
            {projectCards.recommended && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">Recommended project</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <p className="font-semibold">{projectCards.recommended.projectTitle}</p>
                  <p className="text-sm text-muted-foreground">
                    {Math.round(projectCards.recommended.readinessScore * 100)}% ready
                    {projectCards.recommended.estimatedHours !== null && ` · ~${projectCards.recommended.estimatedHours}h`}
                  </p>
                  <p className="text-sm text-muted-foreground">{projectCards.recommended.explanation}</p>
                  <Button asChild size="sm" variant="outline" className="w-fit">
                    <Link href={`/projects/${projectCards.recommended.projectSlug}`}>
                      View project
                      <ArrowRight />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/progress">
          <Card className="h-full transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Mistake DNA</CardTitle>
            </CardHeader>
            <CardContent>
              {topMistakePattern ? (
                <p className="text-sm">
                  Your most repeated mistake: <span className="font-medium">{topMistakePattern.description}</span> ({topMistakePattern.occurrenceCount}×)
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Not enough data yet — solve a few problems to see your patterns.</p>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href="/review">
          <Card className="h-full transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Review queue</CardTitle>
            </CardHeader>
            <CardContent>
              {reviewQueue.length > 0 ? (
                <p className="text-sm">
                  {reviewQueue.length} skill{reviewQueue.length > 1 ? "s" : ""} could use another look.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Nothing to review right now.</p>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Recent progress</h2>
        {recentEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not enough data yet — your activity will show up here.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {recentEntries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{entry.label}</span>
                {entry.detail && <Badge variant="outline">{entry.detail}</Badge>}
              </div>
            ))}
          </div>
        )}
      </section>

      <Card className="border-border/60">
        <CardContent className="flex flex-col gap-4 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">Continue curriculum</p>
            <p className="mt-1 text-lg font-semibold">
              {overview.nextLesson ? overview.nextLesson.title : "No curriculum seeded yet"}
            </p>
          </div>
          <Button asChild variant="outline" disabled={!overview.nextLesson}>
            <Link href={overview.nextLesson ? `/learn/${overview.nextLesson.moduleSlug}/${overview.nextLesson.lessonSlug}` : "/learn"}>
              Continue <ArrowRight />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Flame; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-2">
        <Icon className="size-5 text-muted-foreground" />
        <div>
          <p className="text-lg font-semibold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
