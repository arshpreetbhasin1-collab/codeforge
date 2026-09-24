"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Lock, CircleDashed, TrendingUp, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { SkillGraphNode, SkillGraphStatus } from "@/services/learner/get-skill-graph";
import type { SkillCategory } from "@/types/domain";

const CATEGORY_ORDER: SkillCategory[] = [
  "foundations",
  "control_flow",
  "functions",
  "data_structures",
  "algorithms",
  "complexity",
  "debugging",
  "databases",
  "web",
  "system_design",
  "testing",
];

const CATEGORY_LABEL: Record<SkillCategory, string> = {
  foundations: "Foundations",
  control_flow: "Control Flow",
  functions: "Functions",
  data_structures: "Data Structures",
  algorithms: "Algorithms",
  complexity: "Complexity",
  debugging: "Debugging",
  system_design: "System Design",
  databases: "Databases",
  web: "Web",
  testing: "Testing",
};

const STATUS_META: Record<SkillGraphStatus, { label: string; icon: typeof Lock }> = {
  locked: { label: "Locked", icon: Lock },
  not_started: { label: "Not started", icon: CircleDashed },
  in_progress: { label: "In progress", icon: TrendingUp },
  mastered: { label: "Mastered", icon: CheckCircle2 },
};

export function SkillGraphView({ nodes }: { nodes: SkillGraphNode[] }) {
  const byCategory = new Map<SkillCategory, SkillGraphNode[]>();
  for (const node of nodes) {
    const list = byCategory.get(node.category) ?? [];
    list.push(node);
    byCategory.set(node.category, list);
  }
  for (const list of byCategory.values()) {
    list.sort((a, b) => a.difficulty - b.difficulty || a.skillName.localeCompare(b.skillName));
  }

  const orderedCategories = CATEGORY_ORDER.filter((c) => byCategory.has(c));

  return (
    <div className="flex flex-col gap-10">
      {orderedCategories.map((category, categoryIndex) => (
        <section key={category} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{CATEGORY_LABEL[category]}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(byCategory.get(category) ?? []).map((node, i) => (
              <SkillCard key={node.skillId} node={node} delay={categoryIndex * 0.05 + i * 0.03} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SkillCard({ node, delay }: { node: SkillGraphNode; delay: number }) {
  const meta = STATUS_META[node.status];
  const Icon = meta.icon;
  const isLocked = node.status === "locked";

  const content = (
    <div
      className={cn(
        "flex h-full flex-col gap-3 rounded-lg border p-4 transition-colors",
        isLocked ? "opacity-60" : "hover:bg-muted/50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium">{node.skillName}</span>
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <Icon className="size-3.5" />
          {meta.label}
        </span>
      </div>
      <Progress value={node.masteryScore} />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{node.masteryScore}% mastery</span>
        {node.prerequisiteSkillIds.length > 0 && (
          <span>
            {node.prerequisiteSkillIds.length} prerequisite{node.prerequisiteSkillIds.length > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay }}>
      {isLocked ? content : <Link href={`/skill-graph/${node.skillSlug}`}>{content}</Link>}
    </motion.div>
  );
}
