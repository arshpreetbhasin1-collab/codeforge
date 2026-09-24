"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Sparkles, ArrowLeft } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { fadeIn } from "@/lib/motion/tokens";
import type { ProjectReviewDetail } from "@/services/projects/get-project-review";

const VERDICT_LABEL: Record<string, string> = { passed: "Passed", needs_improvement: "Needs Improvement", failed: "Failed" };
const VERDICT_CLASS: Record<string, string> = {
  passed: "border-brand/30 bg-brand/5 text-brand",
  needs_improvement: "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-500",
  failed: "border-destructive/30 bg-destructive/5 text-destructive",
};

/**
 * The full project review — see PROJECT REVIEW: overall score,
 * strengths/weaknesses, complexity/testing assessment, next recommended
 * action, all deterministic. aiSummary renders in its own clearly-
 * labeled section, never blended with the deterministic fields above it
 * — see AI SAFETY: "AI commentary clearly labeled as AI and kept
 * separate from deterministic test results."
 */
export function ProjectReviewView({ review }: { review: ProjectReviewDetail }) {
  return (
    <motion.div {...fadeIn} className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <Link href={`/projects/${review.projectSlug}`} className="text-xs text-muted-foreground hover:underline">
          <ArrowLeft className="mr-1 inline size-3" />
          {review.projectTitle}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Project Review</h1>
        {review.stageTitle && <p className="mt-1 text-muted-foreground">{review.stageTitle}</p>}
      </div>

      <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${VERDICT_CLASS[review.verdict]}`}>
        {VERDICT_LABEL[review.verdict]} — {review.overallScore}/100
      </div>

      <div>
        <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Score Breakdown</h2>
        <div className="flex flex-col gap-1.5">
          {Object.entries(review.scoreBreakdown).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2 text-sm">
              <span className="w-28 capitalize text-muted-foreground">{key.replace(/([A-Z])/g, " $1")}</span>
              <Progress value={value} className="h-1.5" />
              <span className="w-8 text-right">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {review.strengths.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Strengths</h2>
          <ul className="flex list-inside list-disc flex-col gap-1 text-sm">
            {review.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {review.weaknesses.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Weaknesses</h2>
          <ul className="flex list-inside list-disc flex-col gap-1 text-sm">
            {review.weaknesses.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {review.complexityAssessment && (
          <div>
            <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Complexity</h2>
            <p className="text-sm text-muted-foreground">{review.complexityAssessment}</p>
          </div>
        )}
        {review.testingAssessment && (
          <div>
            <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Testing</h2>
            <p className="text-sm text-muted-foreground">{review.testingAssessment}</p>
          </div>
        )}
      </div>

      {review.nextRecommendedAction && (
        <div className="rounded-lg border p-3">
          <h2 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Next Recommended Action</h2>
          <p className="text-sm">{review.nextRecommendedAction}</p>
        </div>
      )}

      {review.aiSummary ? (
        <div className="rounded-lg border p-3">
          <h2 className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <Sparkles className="size-3.5" />
            AI Commentary
          </h2>
          <p className="text-sm whitespace-pre-line">{review.aiSummary}</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No AI commentary is available for this review (no AI provider configured).</p>
      )}
    </motion.div>
  );
}
