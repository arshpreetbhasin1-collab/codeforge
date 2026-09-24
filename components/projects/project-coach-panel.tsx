"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { requestProjectHintAction } from "@/lib/projects/actions";
import type { ProjectHintLevel } from "@/lib/ai/capabilities";
import type { ExecutableLanguageSlug } from "@/lib/execution/registry";

const LEVEL_LABEL: Record<ProjectHintLevel, string> = {
  1: "Conceptual nudge",
  2: "Approach",
  3: "Pseudocode",
  4: "Targeted debugging",
  5: "Example fragment",
};

interface HintExchange {
  level: ProjectHintLevel;
  question: string;
  content: string;
}

/**
 * "Ask AI Coach" — see AI PROJECT COACH: coach, not judge; 5 progressive
 * levels; never reveals a verdict or hidden tests (the server-side
 * context builder already excludes those, so there's nothing here that
 * could leak them). Levels unlock one at a time, in order — a learner
 * can't jump straight to "give me a code fragment."
 *
 * No AI provider is configured in this environment (see
 * lib/ai/provider.ts) — this honestly surfaces that instead of
 * fabricating a response. Everything else here (context assembly, the
 * hint ladder, usage tracking) is real and functional; only the actual
 * model call is unavailable.
 */
export function ProjectCoachPanel({
  projectId,
  stageId,
  languageSlug,
  sourceCode,
}: {
  projectId: string;
  stageId: string;
  languageSlug: ExecutableLanguageSlug;
  sourceCode: string;
}) {
  const [level, setLevel] = useState<ProjectHintLevel>(1);
  const [question, setQuestion] = useState("");
  const [exchanges, setExchanges] = useState<HintExchange[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAsk() {
    if (!question.trim() || isAsking) return;
    setIsAsking(true);
    setError(null);
    try {
      const result = await requestProjectHintAction({ projectId, stageId, languageSlug, sourceCode, level, question });
      setExchanges((prev) => [...prev, { level, question, content: result.content }]);
      setQuestion("");
      if (level < 5) setLevel((l) => (l + 1) as ProjectHintLevel);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The AI coach isn't available right now.");
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <Sparkles className="size-3.5" />
        Ask AI Coach — {LEVEL_LABEL[level]}
      </div>

      {exchanges.map((exchange, i) => (
        <div key={i} className="rounded-lg bg-muted/50 p-3 text-sm">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Level {exchange.level} — {LEVEL_LABEL[exchange.level]}
          </p>
          <p className="mb-2 text-muted-foreground italic">&ldquo;{exchange.question}&rdquo;</p>
          <p className="whitespace-pre-line">{exchange.content}</p>
        </div>
      ))}

      <Textarea
        placeholder="What are you stuck on?"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        rows={2}
        maxLength={500}
      />

      {error && <p className="text-xs text-muted-foreground">The AI coach isn&apos;t available in this environment (no AI provider configured) — see lib/ai/provider.ts.</p>}

      <Button variant="outline" size="sm" onClick={handleAsk} disabled={isAsking || !question.trim()} className="w-fit">
        {isAsking ? "Asking…" : `Ask for a level ${level} hint`}
      </Button>

      <p className="text-xs text-muted-foreground">The coach only sees your current code, this stage&apos;s visible test results, and your own skill history — never hidden tests, and it never grades your work.</p>
    </div>
  );
}
