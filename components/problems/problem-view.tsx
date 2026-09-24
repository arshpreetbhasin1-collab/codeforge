"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Lightbulb, Play, Send, Sparkles, RotateCcw, ArrowRight, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CodeEditor } from "@/components/editor/code-editor";
import { TestResultsPanel, type ResultDisplayData } from "@/components/execution/test-results-panel";
import { SubmissionHistory } from "@/components/submissions/submission-history";
import { fadeIn } from "@/lib/motion/tokens";
import { requestHintEvent } from "@/lib/learning/actions";
import { runCodeAction, submitCodeAction, getNextRecommendedProblemAction } from "@/lib/execution/actions";
import { EXECUTABLE_LANGUAGES, getExecutableLanguage, type ExecutableLanguageSlug } from "@/lib/execution/registry";
import type { ProblemDetail } from "@/services/learning/get-problem-detail";
import type { NextRecommendedProblem } from "@/services/learning/get-next-recommended-problem";

const DIFFICULTY_LABEL: Record<string, string> = {
  intro: "Beginner",
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  boss: "Boss",
};

const PROBLEM_TYPE_LABEL: Record<string, string> = {
  implementation: "Implementation",
  debugging: "Debugging",
  output_prediction: "Output prediction",
  algorithm_selection: "Algorithm selection",
  complexity_analysis: "Complexity analysis",
  code_completion: "Code completion",
  refactoring: "Refactoring",
  edge_case_reasoning: "Edge-case reasoning",
};

function draftKey(problemId: string, languageSlug: string) {
  return `codeforge:draft:${problemId}:${languageSlug}`;
}

export function ProblemView({ problem, isAuthenticated }: { problem: ProblemDetail; isAuthenticated: boolean }) {
  const availableLanguages = useMemo(
    () =>
      problem.starterCode
        .map((s) => getExecutableLanguage(s.languageSlug))
        .filter((l): l is NonNullable<typeof l> => Boolean(l)),
    [problem.starterCode],
  );

  const [languageSlug, setLanguageSlug] = useState<ExecutableLanguageSlug>(
    availableLanguages[0]?.slug ?? "python",
  );
  const [codeByLanguage, setCodeByLanguage] = useState<Record<string, string>>(() =>
    Object.fromEntries(problem.starterCode.map((s) => [s.languageSlug, s.starterCode])),
  );
  const [hasStarted, setHasStarted] = useState(false);
  const [revealedHints, setRevealedHints] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeResult, setActiveResult] = useState<ResultDisplayData | null>(null);
  const [nextRecommended, setNextRecommended] = useState<NextRecommendedProblem | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [fontSize, setFontSize] = useState(13);
  const [wordWrap, setWordWrap] = useState(false);
  const [minimap, setMinimap] = useState(false);

  // Load a locally-saved draft, if any, once per language switch — syncing
  // FROM an external system (localStorage) INTO React state on prop
  // change is exactly what an effect is for, so the setState here is
  // intentional, not something to hoist into render.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(draftKey(problem.id, languageSlug));
      if (saved !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCodeByLanguage((prev) => ({ ...prev, [languageSlug]: saved }));
      }
    } catch {
      // localStorage unavailable (private mode etc.) — starter code stays as the fallback.
    }
  }, [problem.id, languageSlug]);

  const code = codeByLanguage[languageSlug] ?? "";
  const monacoLanguage = getExecutableLanguage(languageSlug)?.monacoLanguage ?? "plaintext";
  const isSql = languageSlug === "sql";

  function updateCode(next: string) {
    setCodeByLanguage((prev) => ({ ...prev, [languageSlug]: next }));
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(draftKey(problem.id, languageSlug), next);
      } catch {
        // Best-effort only — see AUTOSAVE.
      }
    }
    if (!hasStarted && isAuthenticated) {
      setHasStarted(true);
    }
  }

  function handleResetCode() {
    const starter = problem.starterCode.find((s) => s.languageSlug === languageSlug)?.starterCode ?? "";
    setCodeByLanguage((prev) => ({ ...prev, [languageSlug]: starter }));
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(draftKey(problem.id, languageSlug));
      } catch {
        // ignore
      }
    }
    setResetConfirmOpen(false);
  }

  async function handleRun() {
    if (isRunning || isSubmitting) return;
    setIsRunning(true);
    setActiveResult(null);
    try {
      const result = await runCodeAction({
        problemId: problem.id,
        languageSlug,
        sourceCode: code,
        stdin: undefined,
      });
      setActiveResult({
        kind: "run",
        verdict: result.verdict,
        compileOutput: result.compileOutput,
        visibleTests: result.tests,
        passedCount: result.passedCount,
        totalCount: result.totalCount,
        truncated: result.truncated,
        executionId: result.executionId,
        isSql,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Run failed. Please try again.");
    } finally {
      setIsRunning(false);
    }
  }

  async function handleSubmit() {
    if (isRunning || isSubmitting) return;
    setIsSubmitting(true);
    setActiveResult(null);
    setNextRecommended(null);
    try {
      const result = await submitCodeAction({ problemId: problem.id, languageSlug, sourceCode: code });
      setActiveResult({
        kind: "submit",
        verdict: result.verdict,
        compileOutput: result.compileOutput,
        visibleTests: result.visibleResults,
        hiddenSummary: result.hiddenSummary,
        passedCount: result.passedCount,
        totalCount: result.totalCount,
        runtimeMs: result.runtimeMs,
        memoryKb: result.memoryKb,
        executionId: result.executionId,
        isSql,
      });
      setHistoryRefreshKey((k) => k + 1);
      if (result.verdict === "accepted") {
        getNextRecommendedProblemAction(problem.id).then(setNextRecommended).catch(() => {});
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRevealHint() {
    const next = Math.min(revealedHints + 1, problem.hints.length);
    setRevealedHints(next);
    if (isAuthenticated) {
      await requestHintEvent(problem.id, next).catch(() => {});
    }
  }

  return (
    <motion.div {...fadeIn} className="grid gap-6 lg:grid-cols-2 lg:items-start">
      {/* Problem panel */}
      <div className="flex flex-col gap-5 lg:sticky lg:top-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="capitalize">
              {DIFFICULTY_LABEL[problem.difficulty]}
            </Badge>
            <Badge variant="outline">{PROBLEM_TYPE_LABEL[problem.problemType]}</Badge>
            {problem.skillNames.map((name) => (
              <Badge key={name} variant="outline" className="text-muted-foreground">
                {name}
              </Badge>
            ))}
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{problem.title}</h1>
        </div>

        <p className="text-[15px] leading-relaxed whitespace-pre-line text-foreground/90">{problem.statement}</p>

        {problem.constraints && (
          <div>
            <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Constraints
            </h2>
            <p className="text-sm whitespace-pre-line text-muted-foreground">{problem.constraints}</p>
          </div>
        )}

        {problem.sqlDataset && (
          <div>
            <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Dataset
            </h2>
            <pre className="overflow-x-auto rounded-lg bg-code-surface p-3 font-mono text-xs whitespace-pre-wrap">
              {problem.sqlDataset.schemaSql}
              {"\n\n"}
              {problem.sqlDataset.seedSql}
            </pre>
          </div>
        )}

        {problem.examples.length > 0 && !problem.sqlDataset && (
          <div>
            <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Examples</h2>
            <div className="flex flex-col gap-2">
              {problem.examples.map((example, i) => (
                <div key={i} className="rounded-lg bg-code-surface p-3 font-mono text-xs">
                  <p>
                    <span className="text-muted-foreground">Input:</span> {example.input}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Output:</span> {example.expectedOutput}
                  </p>
                  {example.explanation && (
                    <p className="mt-1 font-sans text-muted-foreground">{example.explanation}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {(problem.expectedTimeComplexity || problem.expectedSpaceComplexity) && (
          <div className="flex gap-4 text-sm text-muted-foreground">
            {problem.expectedTimeComplexity && <span>Time: {problem.expectedTimeComplexity}</span>}
            {problem.expectedSpaceComplexity && <span>Space: {problem.expectedSpaceComplexity}</span>}
          </div>
        )}

        {problem.hints.length > 0 && (
          <div>
            <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <Lightbulb className="size-3.5" />
              Need help?
            </h2>
            <div className="flex flex-col gap-2">
              {problem.hints.slice(0, revealedHints).map((hint) => (
                <div key={hint.level} className="rounded-lg border p-3 text-sm">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Hint {hint.level}</p>
                  {hint.content}
                </div>
              ))}
              {revealedHints < problem.hints.length && (
                <Button variant="outline" size="sm" className="w-fit" onClick={handleRevealHint}>
                  Reveal hint {revealedHints + 1}
                </Button>
              )}
              <Button variant="ghost" size="sm" className="w-fit text-muted-foreground" disabled>
                <Sparkles />
                Ask AI Mentor — coming in Prompt 5
              </Button>
            </div>
          </div>
        )}

        <SubmissionHistorySection problemId={problem.id} refreshKey={historyRefreshKey} />
      </div>

      {/* Editor panel */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Select value={languageSlug} onValueChange={(value) => setLanguageSlug(value as ExecutableLanguageSlug)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              {availableLanguages.map((lang) => (
                <SelectItem key={lang.slug} value={lang.slug}>
                  {lang.displayName}
                </SelectItem>
              ))}
              {availableLanguages.length === 0 &&
                EXECUTABLE_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.slug} value={lang.slug} disabled>
                    {lang.displayName}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <EditorPreferencesMenu
              fontSize={fontSize}
              setFontSize={setFontSize}
              wordWrap={wordWrap}
              setWordWrap={setWordWrap}
              minimap={minimap}
              setMinimap={setMinimap}
            />
            <Button variant="outline" size="sm" onClick={() => setResetConfirmOpen(true)}>
              <RotateCcw />
              Reset
            </Button>
            {problem.isExecutable ? (
              <>
                <Button variant="outline" size="sm" onClick={handleRun} disabled={isRunning || isSubmitting}>
                  <Play />
                  {isRunning ? "Running…" : "Run"}
                </Button>
                <Button size="sm" onClick={handleSubmit} disabled={isRunning || isSubmitting}>
                  <Send />
                  {isSubmitting ? "Submitting…" : "Submit"}
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {getExecutableLanguage(languageSlug)?.starterCodeNote && (
          <p className="text-xs text-muted-foreground">{getExecutableLanguage(languageSlug)!.starterCodeNote}</p>
        )}

        <CodeEditor
          value={code}
          language={monacoLanguage}
          onChange={updateCode}
          fontSize={fontSize}
          wordWrap={wordWrap}
          minimap={minimap}
        />

        <div className="rounded-lg border p-4">
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {activeResult?.kind === "submit" ? "Submission Result" : "Test Results"}
          </h2>
          {!problem.isExecutable ? (
            <p className="text-sm text-muted-foreground">
              This problem doesn&apos;t have a verified execution contract wired up yet — write code here to
              practice, but Run/Submit aren&apos;t available for it.
            </p>
          ) : activeResult ? (
            <AnimatePresence mode="wait">
              <motion.div key={activeResult.kind + activeResult.verdict} {...fadeIn}>
                <TestResultsPanel result={activeResult} />
                {activeResult.verdict === "accepted" && activeResult.kind === "submit" && (
                  <AcceptedFooter nextRecommended={nextRecommended} />
                )}
              </motion.div>
            </AnimatePresence>
          ) : (
            <p className="text-sm text-muted-foreground">Not executed yet.</p>
          )}
        </div>
      </div>

      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset your code?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces your current {getExecutableLanguage(languageSlug)?.displayName} code with the starter
              code. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetCode}>Reset code</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

function AcceptedFooter({ nextRecommended }: { nextRecommended: NextRecommendedProblem | null }) {
  return (
    <motion.div {...fadeIn} className="mt-4 border-t pt-4">
      <p className="mb-2 text-sm font-medium">Problem solved.</p>
      {nextRecommended ? (
        <Button asChild size="sm">
          <Link href={`/practice/${nextRecommended.slug}`}>
            Next: {nextRecommended.title}
            <ArrowRight />
          </Link>
        </Button>
      ) : (
        <Button asChild size="sm" variant="outline">
          <Link href="/practice">
            Back to Practice
            <ArrowRight />
          </Link>
        </Button>
      )}
    </motion.div>
  );
}

function EditorPreferencesMenu({
  fontSize,
  setFontSize,
  wordWrap,
  setWordWrap,
  minimap,
  setMinimap,
}: {
  fontSize: number;
  setFontSize: (n: number) => void;
  wordWrap: boolean;
  setWordWrap: (b: boolean) => void;
  minimap: boolean;
  setMinimap: (b: boolean) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Editor preferences">
          <Settings2 />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="flex items-center justify-between px-2 py-1.5 text-sm">
          <span>Font size</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-xs" onClick={() => setFontSize(Math.max(10, fontSize - 1))}>
              −
            </Button>
            <span className="w-5 text-center text-xs">{fontSize}</span>
            <Button variant="ghost" size="icon-xs" onClick={() => setFontSize(Math.min(20, fontSize + 1))}>
              +
            </Button>
          </div>
        </div>
        <DropdownMenuCheckboxItem checked={wordWrap} onCheckedChange={setWordWrap}>
          Word wrap
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={minimap} onCheckedChange={setMinimap}>
          Minimap
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SubmissionHistorySection({ problemId, refreshKey }: { problemId: string; refreshKey: number }) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Submission history
      </h2>
      <SubmissionHistory problemId={problemId} refreshKey={refreshKey} />
    </div>
  );
}
