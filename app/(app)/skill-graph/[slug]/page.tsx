import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { getSkillDetail } from "@/services/learner/get-skill-detail";
import { getMasteryLevel } from "@/lib/mastery/weights";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${slug} — Skill — CodeForge` };
}

export default async function SkillDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getCurrentProfile();
  if (!profile) {
    return <p className="text-muted-foreground">Sign in to see this skill.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const detail = await getSkillDetail(supabase, profile.id, slug);
  if (!detail) notFound();

  const levelInfo = getMasteryLevel(detail.mastery.masteryScore);

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div>
        <Link href="/skill-graph" className="text-sm text-muted-foreground hover:underline">
          ← Skill Graph
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{detail.skillName}</h1>
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Mastery</span>
          <Badge>{levelInfo.label}</Badge>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold">{detail.mastery.masteryScore}%</span>
          {levelInfo.nextThreshold !== null && (
            <span className="text-sm text-muted-foreground">{levelInfo.nextThreshold - detail.mastery.masteryScore} points to next level</span>
          )}
        </div>
        <Progress value={detail.mastery.masteryScore} />
        <p className="text-xs text-muted-foreground">Confidence: {detail.mastery.confidence}/100 · {detail.mastery.evidenceCount} attempt(s)</p>
        {detail.retention && detail.retention.label !== "high" && (
          <p className="text-xs text-muted-foreground">
            Estimated current recall: {detail.retention.estimatedCurrentScore}/100 ({detail.retention.label}) — last practiced {detail.retention.daysSinceLastPracticed} day(s) ago.
          </p>
        )}
      </section>

      {detail.prerequisites.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Prerequisites</h2>
          <ul className="flex flex-col gap-1">
            {detail.prerequisites.map((p) => (
              <li key={p.skillId} className="flex items-center gap-2 text-sm">
                {p.met ? <CheckCircle2 className="size-4 text-muted-foreground" /> : <XCircle className="size-4 text-muted-foreground" />}
                <span>{p.skillName}</span>
                <span className="text-xs text-muted-foreground">({p.masteryScore}%)</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Evidence</h2>
        {detail.problemsAttempted === 0 ? (
          <p className="text-sm text-muted-foreground">Not enough data yet — solve a problem for this skill to see evidence here.</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {detail.problemsAttempted} attempt(s), {detail.problemsPassed} passed
          </p>
        )}
      </section>

      {detail.commonMistakes.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Common mistakes</h2>
          <div className="flex flex-wrap gap-2">
            {detail.commonMistakes.map((m) => (
              <Badge key={m.category} variant="outline">
                {m.label} × {m.occurrenceCount}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {detail.recommendedHref && (
        <Button asChild className="self-start">
          <Link href={detail.recommendedHref}>Continue</Link>
        </Button>
      )}
    </div>
  );
}
