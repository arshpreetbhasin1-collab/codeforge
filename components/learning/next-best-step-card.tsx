"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Recommendation } from "@/lib/recommendations/types";

const TYPE_LABEL: Record<string, string> = {
  LEARN: "Learn",
  PRACTICE: "Practice",
  REINFORCE: "Reinforce",
  REVIEW: "Review",
  DIAGNOSTIC: "Diagnostic",
  TRANSFER: "Transfer",
  CHALLENGE: "Challenge",
  PROJECT_PREP: "Almost ready",
  PROJECT: "Project",
};

export function NextBestStepCard({ recommendation, href }: { recommendation: Recommendation | null; href: string | null }) {
  if (!recommendation) {
    return (
      <Card className="border-brand/30 bg-brand/5">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">Not enough data yet — solve a problem or start a lesson to get your first recommendation.</p>
        </CardContent>
      </Card>
    );
  }

  const title = recommendation.skillName ?? recommendation.projectTitle ?? "Continue learning";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className="border-brand/30 bg-brand/5">
        <CardContent className="flex flex-col gap-4 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <Badge>{TYPE_LABEL[recommendation.type] ?? recommendation.type}</Badge>
            <p className="mt-2 text-xl font-semibold">{title}</p>
            <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
              {recommendation.reasons.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          </div>
          {href && (
            <Button asChild size="lg">
              <Link href={href}>Start</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
