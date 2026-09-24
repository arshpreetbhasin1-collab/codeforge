"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Lock, CheckCircle2, Circle, ArrowRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { fadeIn } from "@/lib/motion/tokens";
import { startProjectAction } from "@/lib/projects/actions";
import type { ProjectDetail } from "@/services/projects/get-project-detail";

const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

const SCORING_LABEL: Record<string, string> = {
  correctness: "Correctness",
  edgeCases: "Edge Cases",
  efficiency: "Efficiency",
  codeQuality: "Code Quality",
  testing: "Testing",
};

export function ProjectDetailView({ project, isAuthenticated }: { project: ProjectDetail; isAuthenticated: boolean }) {
  return (
    <motion.div {...fadeIn} className="mx-auto flex max-w-3xl flex-col gap-8">
      <Header project={project} />
      <ReadinessBanner project={project} isAuthenticated={isAuthenticated} />

      {project.overview && <Section title="Overview">{project.overview}</Section>}
      {project.problemStatement && <Section title="The Problem">{project.problemStatement}</Section>}
      {project.whyItMatters && <Section title="Why It Matters">{project.whyItMatters}</Section>}

      {project.objectives.length > 0 && (
        <ListSection title="Objectives" items={project.objectives} />
      )}

      {project.requirements.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Requirements</h2>
          <div className="flex flex-col gap-2">
            {project.requirements.map((r) => (
              <div key={r.title} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{r.title}</p>
                <p className="text-muted-foreground">{r.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {project.constraintsList.length > 0 && <ListSection title="Constraints" items={project.constraintsList} />}

      {project.stages.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Milestones</h2>
          <div className="flex flex-col gap-2">
            {project.stages.map((stage, i) => (
              <div key={stage.id} className="flex items-start gap-2 rounded-lg border p-3 text-sm">
                {stage.status === "completed" ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" />
                ) : (
                  <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground/30" />
                )}
                <div>
                  <p className="font-medium">
                    {i + 1}. {stage.title}
                  </p>
                  <p className="text-muted-foreground">{stage.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {project.examples.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Examples</h2>
          <div className="flex flex-col gap-2">
            {project.examples.map((example, i) => (
              <div key={i} className="rounded-lg bg-code-surface p-3 font-mono text-xs">
                <p>
                  <span className="text-muted-foreground">Input:</span> {example.input}
                </p>
                <p className="whitespace-pre-line">
                  <span className="text-muted-foreground">Output:</span> {example.output}
                </p>
                {example.explanation && <p className="mt-1 font-sans text-muted-foreground">{example.explanation}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {project.starterInstructions && <Section title="Getting Started">{project.starterInstructions}</Section>}

      <div>
        <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Evaluation Criteria</h2>
        <div className="flex flex-col gap-1.5 rounded-lg border p-3 text-sm">
          {Object.entries(project.scoringWeights).map(([key, weight]) => (
            <div key={key} className="flex items-center justify-between">
              <span>{SCORING_LABEL[key] ?? key}</span>
              <span className="text-muted-foreground">{weight}%</span>
            </div>
          ))}
        </div>
      </div>

      {project.skills.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Skills</h2>
          <div className="flex flex-wrap gap-1.5">
            {project.skills
              .filter((s) => s.relationship === "prerequisite")
              .map((s) => (
                <Badge key={`prereq-${s.skillId}`} variant="outline">
                  Requires: {s.skillName}
                </Badge>
              ))}
            {project.skills
              .filter((s) => s.relationship === "demonstrates")
              .map((s) => (
                <Badge key={`demo-${s.skillId}`} variant="secondary">
                  Demonstrates: {s.skillName}
                </Badge>
              ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function Header({ project }: { project: ProjectDetail }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="capitalize">
          {DIFFICULTY_LABEL[project.difficulty]}
        </Badge>
        {project.estimatedHours !== null && (
          <Badge variant="outline" className="gap-1">
            <Clock className="size-3" />~{project.estimatedHours}h
          </Badge>
        )}
        {project.languageSlugs.map((slug) => (
          <Badge key={slug} variant="outline" className="uppercase">
            {slug}
          </Badge>
        ))}
      </div>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{project.title}</h1>
      <p className="mt-1 text-muted-foreground">{project.description}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: string }) {
  return (
    <div>
      <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      <p className="text-[15px] leading-relaxed whitespace-pre-line text-foreground/90">{children}</p>
    </div>
  );
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      <ul className="flex list-inside list-disc flex-col gap-1 text-sm text-foreground/90">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function ReadinessBanner({ project, isAuthenticated }: { project: ProjectDetail; isAuthenticated: boolean }) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);

  if (!isAuthenticated) {
    return (
      <Card>
        <CardContent className="py-4 text-sm text-muted-foreground">
          <Link href="/login" className="text-brand underline">
            Log in
          </Link>{" "}
          to see your readiness for this project.
        </CardContent>
      </Card>
    );
  }

  const readiness = project.readiness;
  const isReady = readiness?.isReady ?? false;
  const verdict = project.progressVerdict;

  async function handleStart() {
    setIsStarting(true);
    try {
      const result = await startProjectAction(project.id);
      router.push(result.firstStageSlug ? `/projects/${project.slug}/workspace?stage=${result.firstStageSlug}` : `/projects/${project.slug}/workspace`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't start this project. Please try again.");
      setIsStarting(false);
    }
  }

  if (verdict === "passed") {
    return (
      <Card className="border-brand/30 bg-brand/5">
        <CardContent className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Completed{project.bestScore !== null ? ` — score ${project.bestScore}/100` : ""}</p>
            <p className="text-sm text-muted-foreground">You can review your work or rebuild it from scratch.</p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={`/projects/${project.slug}/workspace`}>
              View workspace
              <ArrowRight />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (verdict === "in_progress" || verdict === "needs_improvement" || verdict === "failed") {
    return (
      <Card className="border-brand/30 bg-brand/5">
        <CardContent className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium">
            {verdict === "in_progress" ? "You're partway through this project." : "Your last submission didn't pass yet — the review has specific next steps."}
          </p>
          <Button asChild size="sm">
            <Link href={`/projects/${project.slug}/workspace`}>
              Continue building
              <ArrowRight />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!isReady) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-2 py-4">
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-muted-foreground" />
            <p className="font-medium">Not unlocked yet</p>
          </div>
          <p className="text-sm text-muted-foreground">{readiness?.explanation ?? "Build more skill mastery to unlock this project."}</p>
          {readiness && <Progress value={Math.round(readiness.readinessScore * 100)} className="h-1.5" />}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-brand/30 bg-brand/5">
      <CardContent className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-medium">{readiness?.explanation ?? "You're ready to build this project."}</p>
        <Button size="sm" onClick={handleStart} disabled={isStarting}>
          {isStarting ? "Starting…" : "Start project"}
          <ArrowRight />
        </Button>
      </CardContent>
    </Card>
  );
}
