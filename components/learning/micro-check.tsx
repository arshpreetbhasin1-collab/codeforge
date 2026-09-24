"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fadeInUp } from "@/lib/motion/tokens";
import { submitMicroCheck } from "@/lib/learning/actions";
import type { LessonDetailMicroCheck } from "@/services/learning/get-lesson-detail";

export function MicroCheckWidget({ check, index }: { check: LessonDetailMicroCheck; index: number }) {
  const [selected, setSelected] = useState("");
  const [result, setResult] = useState<{ isCorrect: boolean; explanation: string } | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit() {
    if (!selected.trim() || isPending) return;
    setIsPending(true);
    try {
      const outcome = await submitMicroCheck(check.id, selected);
      setResult(outcome);
    } catch {
      toast.error("Couldn't check your answer. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  const isConceptual = check.type === "conceptual";

  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs font-medium text-muted-foreground">Micro check {index + 1}</p>
      {check.codeSnippet && (
        <pre className="mt-2 overflow-x-auto rounded-md bg-code-surface p-3 font-mono text-sm">
          <code>{check.codeSnippet}</code>
        </pre>
      )}
      <p className="mt-2 text-sm font-medium">{check.question}</p>

      {!result && check.type === "multiple_choice" && check.options && (
        <div className="mt-3 flex flex-col gap-2">
          {check.options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelected(option.id)}
              className={cn(
                "rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                selected === option.id && "border-brand bg-brand/5",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {!result && check.type === "predict_output" && (
        <Input
          className="mt-3"
          placeholder="What will this print?"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        />
      )}

      {!result && isConceptual && (
        <Input
          className="mt-3"
          placeholder="Take a guess — then see the explanation"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        />
      )}

      {!result && (
        <Button size="sm" className="mt-3" disabled={!selected.trim() || isPending} onClick={handleSubmit}>
          {isPending ? "Checking…" : "Check answer"}
        </Button>
      )}

      <AnimatePresence>
        {result && (
          <motion.div {...fadeInUp} className="mt-3 flex items-start gap-2 rounded-md bg-muted p-3 text-sm">
            {isConceptual ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" />
            ) : result.isCorrect ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" />
            ) : (
              <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            )}
            <div>
              {!isConceptual && (
                <p className="font-medium">{result.isCorrect ? "Correct" : "Not quite"}</p>
              )}
              <p className="text-muted-foreground">{result.explanation}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
