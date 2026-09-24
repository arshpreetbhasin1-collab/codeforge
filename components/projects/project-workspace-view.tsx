"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { CheckCircle2, Circle, Lock, Play, Send, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CodeEditor } from "@/components/editor/code-editor";
import { TestResultsPanel, type ResultDisplayData } from "@/components/execution/test-results-panel";
import { ProjectCoachPanel } from "@/components/projects/project-coach-panel";
import { fadeIn } from "@/lib/motion/tokens";
import { runProjectStageAction, submitProjectStageAction } from "@/lib/projects/actions";
import { EXECUTABLE_LANGUAGES, getExecutableLanguage, type ExecutableLanguageSlug } from "@/lib/execution/registry";
import type { SubmitProjectStageResult } from "@/services/projects/submit-project-stage";
import type { ProjectWorkspaceData, WorkspaceStage } from "@/services/projects/get-workspace-data";

const VERDICT_LABEL: Record<string, string> = {
  passed: "Passed",
  needs_improvement: "Needs Improvement",
  failed: "Failed",
};

const VERDICT_CLASS: Record<string, string> = {
  passed: "border-brand/30 bg-brand/5 text-brand",
  needs_improvement: "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-500",
  failed: "border-destructive/30 bg-destructive/5 text-destructive",
};

/**
 * Scoped by userId — stage ids are shared across every learner working on
 * a project, so a key without the viewer's own id would leak one
 * learner's unsaved draft to another learner sharing the same browser.
 * Submitted/graded work is never affected (that's server-side, scoped by
 * RLS); only this client-only convenience cache was at risk.
 */
function draftKey(userId: string, stageId: string, languageSlug: string) {
  return `codeforge:project-draft:${userId}:${stageId}:${languageSlug}`;
}

/**
 * Keyed by stage id so switching stages (including auto-advance after a
 * passing submission, via router.refresh()) fully remounts this component
 * — otherwise React would keep the previous stage's `code`/`languageSlug`
 * state alive across a prop update, showing stale code under the new
 * stage's title. A remount re-runs loadDraft() for the actual new stage.
 */
export function ProjectWorkspaceView({ data }: { data: ProjectWorkspaceData }) {
  return <ProjectWorkspaceStageView key={data.currentStage.id} data={data} />;
}

function ProjectWorkspaceStageView({ data }: { data: ProjectWorkspaceData }) {
  const router = useRouter();
  const availableLanguages = data.languageSlugs.map((slug) => getExecutableLanguage(slug)).filter((l): l is NonNullable<typeof l> => Boolean(l));

  const [languageSlug, setLanguageSlug] = useState<ExecutableLanguageSlug>(availableLanguages[0]?.slug ?? "python");
  const [code, setCode] = useState(() => loadDraft(data.userId, data.currentStage.id, availableLanguages[0]?.slug ?? "python"));
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runResult, setRunResult] = useState<ResultDisplayData | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitProjectStageResult | null>(null);
  const [mobilePanel, setMobilePanel] = useState<"nav" | "editor" | "context">("editor");

  const monacoLanguage = getExecutableLanguage(languageSlug)?.monacoLanguage ?? "plaintext";

  function updateCode(next: string) {
    setCode(next);
    saveDraft(data.userId, data.currentStage.id, languageSlug, next);
  }

  function switchLanguage(next: ExecutableLanguageSlug) {
    setLanguageSlug(next);
    setCode(loadDraft(data.userId, data.currentStage.id, next));
    setRunResult(null);
    setSubmitResult(null);
  }

  async function handleRun() {
    if (isRunning || isSubmitting) return;
    setIsRunning(true);
    setRunResult(null);
    setSubmitResult(null);
    try {
      const result = await runProjectStageAction({ projectId: data.projectId, stageId: data.currentStage.id, languageSlug, sourceCode: code });
      setRunResult({
        kind: "run",
        verdict: result.verdict,
        compileOutput: result.compileOutput,
        visibleTests: result.tests,
        passedCount: result.passedCount,
        totalCount: result.totalCount,
        truncated: result.truncated,
        executionId: result.executionId,
        isSql: languageSlug === "sql",
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
    setRunResult(null);
    setSubmitResult(null);
    try {
      const result = await submitProjectStageAction({ projectId: data.projectId, stageId: data.currentStage.id, languageSlug, sourceCode: code });
      setSubmitResult(result);
      if (result.nextStageSlug) {
        router.refresh();
      } else if (result.isProjectComplete) {
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <motion.div {...fadeIn} className="flex flex-col gap-4">
      <WorkspaceHeader data={data} />

      {/* Mobile: tab switcher instead of forcing 3 columns — see WORKSPACE MOBILE. */}
      <div className="lg:hidden">
        <Tabs value={mobilePanel} onValueChange={(v) => setMobilePanel(v as typeof mobilePanel)}>
          <TabsList className="w-full">
            <TabsTrigger value="nav" className="flex-1">
              Stages
            </TabsTrigger>
            <TabsTrigger value="editor" className="flex-1">
              Editor
            </TabsTrigger>
            <TabsTrigger value="context" className="flex-1">
              Details
            </TabsTrigger>
          </TabsList>
          <TabsContent value="nav">
            <StageNav data={data} />
          </TabsContent>
          <TabsContent value="editor">
            <EditorPanel
              data={data}
              availableLanguages={availableLanguages}
              languageSlug={languageSlug}
              setLanguageSlug={switchLanguage}
              code={code}
              updateCode={updateCode}
              monacoLanguage={monacoLanguage}
              isRunning={isRunning}
              isSubmitting={isSubmitting}
              onRun={handleRun}
              onSubmit={handleSubmit}
            />
          </TabsContent>
          <TabsContent value="context">
            <ContextPanel data={data} runResult={runResult} submitResult={submitResult} languageSlug={languageSlug} code={code} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Desktop: real three-panel layout. */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-[200px_1fr_360px] lg:items-start">
        <StageNav data={data} />
        <EditorPanel
          data={data}
          availableLanguages={availableLanguages}
          languageSlug={languageSlug}
          setLanguageSlug={switchLanguage}
          code={code}
          updateCode={updateCode}
          monacoLanguage={monacoLanguage}
          isRunning={isRunning}
          isSubmitting={isSubmitting}
          onRun={handleRun}
          onSubmit={handleSubmit}
        />
        <div className="sticky top-6">
          <ContextPanel data={data} runResult={runResult} submitResult={submitResult} languageSlug={languageSlug} code={code} />
        </div>
      </div>
    </motion.div>
  );
}

function WorkspaceHeader({ data }: { data: ProjectWorkspaceData }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <Link href={`/projects/${data.projectSlug}`} className="text-xs text-muted-foreground hover:underline">
          ← {data.projectTitle}
        </Link>
        <h1 className="text-lg font-semibold">{data.currentStage.title}</h1>
      </div>
      {data.bestScore !== null && (
        <Badge variant="outline">
          Best score: {data.bestScore}/100
        </Badge>
      )}
    </div>
  );
}

function StageNav({ data }: { data: ProjectWorkspaceData }) {
  return (
    <div className="flex flex-col gap-1.5">
      {data.stages.map((stage, i) => (
        <StageNavItem key={stage.id} stage={stage} index={i} projectSlug={data.projectSlug} isActive={stage.id === data.currentStage.id} />
      ))}
    </div>
  );
}

function StageNavItem({ stage, index, projectSlug, isActive }: { stage: WorkspaceStage; index: number; projectSlug: string; isActive: boolean }) {
  const content = (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
        isActive ? "border-brand/40 bg-brand/5 font-medium" : stage.isReachable ? "hover:bg-muted/50" : "text-muted-foreground/50"
      }`}
    >
      {stage.status === "completed" ? (
        <CheckCircle2 className="size-4 shrink-0 text-brand" />
      ) : stage.isReachable ? (
        <Circle className="size-4 shrink-0 text-muted-foreground/40" />
      ) : (
        <Lock className="size-4 shrink-0 text-muted-foreground/30" />
      )}
      <span>
        {index + 1}. {stage.title}
      </span>
    </div>
  );

  if (!stage.isReachable) return content;
  return <Link href={`/projects/${projectSlug}/workspace?stage=${stage.slug}`}>{content}</Link>;
}

function EditorPanel({
  data,
  availableLanguages,
  languageSlug,
  setLanguageSlug,
  code,
  updateCode,
  monacoLanguage,
  isRunning,
  isSubmitting,
  onRun,
  onSubmit,
}: {
  data: ProjectWorkspaceData;
  availableLanguages: NonNullable<ReturnType<typeof getExecutableLanguage>>[];
  languageSlug: ExecutableLanguageSlug;
  setLanguageSlug: (slug: ExecutableLanguageSlug) => void;
  code: string;
  updateCode: (next: string) => void;
  monacoLanguage: string;
  isRunning: boolean;
  isSubmitting: boolean;
  onRun: () => void;
  onSubmit: () => void;
}) {
  const stageLocked = data.currentStage.status === "completed" && data.overallVerdict === "passed";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={languageSlug} onValueChange={(v) => setLanguageSlug(v as ExecutableLanguageSlug)}>
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
          <Button variant="outline" size="sm" onClick={onRun} disabled={isRunning || isSubmitting}>
            <Play />
            {isRunning ? "Running…" : "Run"}
          </Button>
          <Button size="sm" onClick={onSubmit} disabled={isRunning || isSubmitting}>
            <Send />
            {isSubmitting ? "Submitting…" : "Submit"}
          </Button>
        </div>
      </div>

      {stageLocked && <p className="text-xs text-muted-foreground">This project is complete — you can keep editing and resubmit to try for a higher score.</p>}

      <CodeEditor value={code} language={monacoLanguage} onChange={updateCode} fontSize={13} wordWrap={false} minimap={false} />
    </div>
  );
}

function ContextPanel({
  data,
  runResult,
  submitResult,
  languageSlug,
  code,
}: {
  data: ProjectWorkspaceData;
  runResult: ResultDisplayData | null;
  submitResult: SubmitProjectStageResult | null;
  languageSlug: ExecutableLanguageSlug;
  code: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {submitResult ? (
        <SubmitResultsPanel result={submitResult} data={data} />
      ) : runResult ? (
        <AnimatePresence mode="wait">
          <motion.div key={runResult.kind + runResult.verdict} {...fadeIn}>
            <TestResultsPanel result={runResult} />
          </motion.div>
        </AnimatePresence>
      ) : (
        <>
          {data.currentStageRequirements.length > 0 && (
            <div>
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Requirements</h2>
              <ul className="flex list-inside list-disc flex-col gap-1 text-sm text-foreground/90">
                {data.currentStageRequirements.map((r, i) => (
                  <li key={i}>{r.description}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Progress</h2>
            <p className="text-sm text-muted-foreground">
              {data.stages.filter((s) => s.status === "completed").length} / {data.stages.length} stages complete
            </p>
          </div>
          <p className="text-sm text-muted-foreground">Run your code against the visible tests, then Submit when ready — hidden tests are graded on submit.</p>
        </>
      )}

      <ProjectCoachPanel projectId={data.projectId} stageId={data.currentStage.id} languageSlug={languageSlug} sourceCode={code} />
    </div>
  );
}

function SubmitResultsPanel({ result, data }: { result: SubmitProjectStageResult; data: ProjectWorkspaceData }) {
  return (
    <div className="flex flex-col gap-4">
      <div className={`rounded-lg border px-3 py-2 text-sm font-medium ${VERDICT_CLASS[result.verdict]}`}>
        {VERDICT_LABEL[result.verdict]} — {result.score}/100
      </div>

      <div className="flex flex-col gap-1.5 text-xs">
        {Object.entries(result.scoreBreakdown).map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="w-24 capitalize text-muted-foreground">{key.replace(/([A-Z])/g, " $1")}</span>
            <Progress value={value} className="h-1.5" />
            <span className="w-8 text-right">{value}</span>
          </div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        {result.passedCount} / {result.totalCount} visible + hidden tests passed
        {result.hiddenSummary.total > 0 && ` (hidden: ${result.hiddenSummary.passed}/${result.hiddenSummary.total})`}
      </p>

      {result.compileOutput && (
        <pre className="overflow-x-auto rounded-lg bg-code-surface p-3 font-mono text-xs whitespace-pre-wrap">{result.compileOutput}</pre>
      )}

      <div className="flex flex-col gap-2">
        {result.visibleResults.map((test, i) => (
          <div key={test.testCaseId} className={`rounded-lg border p-3 text-sm ${test.passed ? "border-brand/30" : "border-destructive/30"}`}>
            <p className="mb-2 font-medium">Test {i + 1}</p>
            <div className="grid gap-2 font-mono text-xs sm:grid-cols-3">
              <div>
                <p className="mb-1 font-sans text-muted-foreground">Input</p>
                <pre className="overflow-x-auto rounded bg-code-surface p-2 whitespace-pre-wrap">{test.input}</pre>
              </div>
              <div>
                <p className="mb-1 font-sans text-muted-foreground">Expected</p>
                <pre className="overflow-x-auto rounded bg-code-surface p-2 whitespace-pre-wrap">{test.expectedOutput}</pre>
              </div>
              <div>
                <p className="mb-1 font-sans text-muted-foreground">Your output</p>
                <pre className="overflow-x-auto rounded bg-code-surface p-2 whitespace-pre-wrap">{test.actualOutput || "(empty)"}</pre>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button asChild size="sm" variant="outline" className="w-fit">
        <Link href={`/projects/${data.projectSlug}/reviews/${result.reviewId}`}>
          View full review
          <ArrowRight />
        </Link>
      </Button>

      {result.isProjectComplete && (
        <div className="rounded-lg border-t pt-4">
          <p className="mb-2 text-sm font-medium">Project complete.</p>
          <Button asChild size="sm">
            <Link href="/projects">
              Back to Projects
              <ArrowRight />
            </Link>
          </Button>
        </div>
      )}
      {!result.isProjectComplete && result.nextStageSlug && (
        <Button asChild size="sm">
          <Link href={`/projects/${data.projectSlug}/workspace?stage=${result.nextStageSlug}`}>
            Next stage
            <ArrowRight />
          </Link>
        </Button>
      )}
    </div>
  );
}

function loadDraft(userId: string, stageId: string, languageSlug: string): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(draftKey(userId, stageId, languageSlug)) ?? "";
  } catch {
    return "";
  }
}

function saveDraft(userId: string, stageId: string, languageSlug: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(draftKey(userId, stageId, languageSlug), value);
  } catch {
    // best-effort only
  }
}
