"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { BookOpen, Dumbbell, Bug, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ReviewQueueItem, ReviewAction } from "@/services/learner/get-review-queue";

const ACTION_META: Record<ReviewAction, { label: string; icon: typeof BookOpen }> = {
  REVIEW_LESSON: { label: "Review lesson", icon: BookOpen },
  PRACTICE: { label: "Practice", icon: Dumbbell },
  DEBUG: { label: "Debug", icon: Bug },
  TRY_AGAIN: { label: "Try again", icon: RotateCcw },
};

export function ReviewQueueList({ items }: { items: ReviewQueueItem[] }) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => {
        const meta = ACTION_META[item.action];
        const Icon = meta.icon;
        return (
          <motion.div key={item.skillId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: i * 0.04 }}>
            <Link href={`/skill-graph/${item.skillSlug}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex items-start justify-between gap-4 py-1">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{item.skillName}</span>
                    <span className="text-sm text-muted-foreground">{item.reason}</span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant="secondary" className="gap-1">
                      <Icon className="size-3" />
                      {meta.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">~{item.estimatedMinutes} min</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
