import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { getLearnerProfile } from "@/services/learner/get-learner-profile";
import { getProgressHistory } from "@/services/learner/get-progress-history";
import { estimateRetention } from "@/lib/mastery/decay";
import { getMasteryLevel } from "@/lib/mastery/weights";
import { MISTAKE_CATEGORY_LABEL } from "@/lib/mistakes/taxonomy";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ComingSoon } from "@/components/layout/coming-soon";
import type { MasteryLevel } from "@/types/domain";

export const metadata: Metadata = { title: "Progress — CodeForge" };

const LEVEL_BADGE_VARIANT: Record<MasteryLevel, "outline" | "secondary" | "default"> = {
  not_started: "outline",
  exploring: "outline",
  developing: "secondary",
  competent: "secondary",
  strong: "default",
  mastered: "default",
};

export default async function ProgressPage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return (
      <ComingSoon
        title="Progress"
        description="Sign in to see mastery, retention, and readiness over time — all traceable to real learning events."
        prompt="Prompt 4"
      />
    );
  }

  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const [learnerProfile, { data: skillRows }, progressHistory] = await Promise.all([
    getLearnerProfile(supabase, profile.id, now),
    supabase.from("skills").select("id, slug, name"),
    getProgressHistory(supabase, profile.id, now),
  ]);

  const skillNameById = new Map((skillRows ?? []).map((s) => [s.id as string, s.name as string]));
  const skillSlugById = new Map((skillRows ?? []).map((s) => [s.id as string, s.slug as string]));

  const masteredSkills = [...learnerProfile.skillMastery].sort((a, b) => b.masteryScore - a.masteryScore);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
        <p className="mt-1 text-muted-foreground">
          Every number here is computed from your real submission history — see the reasons under each recommendation.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">What to do next</h2>
        {learnerProfile.recommendations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No submissions yet — solve a problem in Practice to get your first recommendation.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {learnerProfile.recommendations.map((rec, i) => (
              <Card key={`${rec.type}-${rec.skillId ?? rec.projectId}`} className={i === 0 ? "border-brand/40 bg-brand/5" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Badge variant={i === 0 ? "default" : "secondary"}>{rec.type.replace("_", " ")}</Badge>
                  </div>
                  <CardTitle className="text-base">
                    {rec.skillName ?? rec.projectTitle}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                    {rec.reasons.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Skill mastery</h2>
        {masteredSkills.length === 0 ? (
          <p className="text-sm text-muted-foreground">No mastery data yet — it builds as you submit solutions.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {masteredSkills.map((skill) => {
              const levelInfo = getMasteryLevel(skill.masteryScore);
              const retention = skill.lastReviewedAt
                ? estimateRetention(skill.masteryScore, new Date(skill.lastReviewedAt), now)
                : null;
              return (
                <Card key={skill.skillId}>
                  <CardContent className="flex flex-col gap-2 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <Link href={`/skill-graph/${skillSlugById.get(skill.skillId) ?? ""}`} className="font-medium hover:underline">
                        {skillNameById.get(skill.skillId) ?? "Unknown skill"}
                      </Link>
                      <Badge variant={LEVEL_BADGE_VARIANT[levelInfo.level]}>{levelInfo.label}</Badge>
                    </div>
                    <Progress value={skill.masteryScore} />
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Mastery {skill.masteryScore}/100</span>
                      <span>Confidence {skill.confidence}/100 ({skill.attemptCount} attempt(s))</span>
                      <span>
                        Independent:{" "}
                        {skill.independentScore === null ? "not enough hint-free evidence yet" : `${skill.independentScore}/100`}
                      </span>
                      {retention && (
                        <span>
                          Retention: {retention.label} (~{retention.estimatedCurrentScore}/100 estimated today)
                        </span>
                      )}
                      {levelInfo.nextThreshold !== null && <span>{levelInfo.nextThreshold - skill.masteryScore} points to next level</span>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Mistake patterns</h2>
        {learnerProfile.mistakeProfile.topPatterns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recurring mistake patterns detected yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {learnerProfile.mistakeProfile.topPatterns.map((pattern) => (
              <Badge key={pattern.id} variant="outline" className="h-auto py-1">
                {pattern.description} × {pattern.occurrenceCount}
              </Badge>
            ))}
          </div>
        )}

        {learnerProfile.mistakeProfile.recentEvents.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">Recent activity</h3>
            {learnerProfile.mistakeProfile.recentEvents.slice(0, 5).map((event) => (
              <div key={event.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{MISTAKE_CATEGORY_LABEL[event.category]}</p>
                {event.evidence && <p className="text-muted-foreground">{event.evidence}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Project readiness</h2>
        {learnerProfile.projectReadiness.length === 0 ? (
          <p className="text-sm text-muted-foreground">No projects published yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {learnerProfile.projectReadiness.map((project) => (
              <Card key={project.projectId}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{project.projectTitle}</CardTitle>
                    <Badge variant={project.isReady ? "default" : "outline"}>
                      {project.isReady ? "Ready" : `${Math.round(project.readinessScore * 100)}%`}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Progress value={project.readinessScore * 100} />
                  {project.missingSkills.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Still needed: {project.missingSkills.map((s) => s.skillName).join(", ")}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">History</h2>
        {progressHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not enough data yet — completed lessons, solved problems, and mastery changes will show up here.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {progressHistory.map((day) => (
              <div key={day.date} className="flex flex-col gap-1.5">
                <h3 className="text-sm font-medium text-muted-foreground">{day.dayLabel}</h3>
                {day.entries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span>{entry.label}</span>
                    {entry.detail && <Badge variant="outline">{entry.detail}</Badge>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
