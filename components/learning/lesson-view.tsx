"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fadeIn, fadeInUp } from "@/lib/motion/tokens";
import { markLessonCompleted, markLessonStarted } from "@/lib/learning/actions";
import { MicroCheckWidget } from "@/components/learning/micro-check";
import type { LessonDetail, LessonDetailCodeExample } from "@/services/learning/get-lesson-detail";

const LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  java: "Java",
  c: "C",
  cpp: "C++",
};

/**
 * lesson.exampleCode/exampleLanguageSlug is the primary, always-present
 * example (Prompt 1); lesson.codeExamples holds language alternates
 * (Prompt 2 — see LANGUAGE STRATEGY). The tab list must show both, primary
 * first, not just the alternates.
 */
function mergedCodeExamples(lesson: LessonDetail): LessonDetailCodeExample[] {
  const primary: LessonDetailCodeExample | null = lesson.exampleLanguageSlug
    ? {
        languageSlug: lesson.exampleLanguageSlug,
        languageName: LANGUAGE_DISPLAY_NAMES[lesson.exampleLanguageSlug] ?? lesson.exampleLanguageSlug,
        code: lesson.exampleCode,
        explanation: null,
      }
    : null;

  const alternates = lesson.codeExamples.filter((ex) => ex.languageSlug !== primary?.languageSlug);
  return primary ? [primary, ...alternates] : alternates;
}

export function LessonView({ lesson, isAuthenticated }: { lesson: LessonDetail; isAuthenticated: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState(lesson.status);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    if (isAuthenticated && lesson.status === "not_started") {
      markLessonStarted(lesson.id).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id, isAuthenticated]);

  async function handleComplete() {
    if (isCompleting) return;
    setIsCompleting(true);
    try {
      if (isAuthenticated) {
        await markLessonCompleted(lesson.id);
      }
      setStatus("completed");
      if (lesson.nextLesson) {
        router.push(`/learn/${lesson.nextLesson.moduleSlug}/${lesson.nextLesson.lessonSlug}`);
      } else {
        router.push("/learn");
      }
    } catch {
      toast.error("Couldn't save your progress. Please try again.");
    } finally {
      setIsCompleting(false);
    }
  }

  return (
    <motion.div {...fadeIn} className="mx-auto flex max-w-2xl flex-col gap-8 pb-16">
      <div>
        <Link
          href="/learn"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {lesson.moduleTitle}
        </Link>
        <div className="mt-3 flex items-center gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">{lesson.title}</h1>
          {status === "completed" && <CheckCircle2 className="size-6 text-brand" />}
        </div>
        <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" />
            {lesson.estimatedMinutes} min
          </span>
          {lesson.learningObjectives.length > 0 && (
            <span>{lesson.learningObjectives.length} learning objective(s)</span>
          )}
        </div>
      </div>

      {lesson.learningObjectives.length > 0 && (
        <Section title="You'll be able to">
          <ul className="flex flex-col gap-1.5">
            {lesson.learningObjectives.map((obj) => (
              <li key={obj} className="flex gap-2 text-sm">
                <span className="text-brand">—</span>
                {obj}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Why">
        <p className="text-[15px] leading-relaxed text-foreground/90">{lesson.why}</p>
      </Section>

      <Section title="What">
        <p className="text-[15px] leading-relaxed text-foreground/90">{lesson.what}</p>
      </Section>

      <Section title="Mental model">
        <p className="text-[15px] leading-relaxed text-foreground/90">{lesson.how}</p>
      </Section>

      <Section title="Example">
        {(() => {
          const examples = mergedCodeExamples(lesson);
          if (examples.length === 0) return <CodeBlock code={lesson.exampleCode} />;
          if (examples.length === 1) {
            return (
              <>
                <CodeBlock code={examples[0].code} />
                {examples[0].explanation && (
                  <p className="mt-2 text-sm text-muted-foreground">{examples[0].explanation}</p>
                )}
              </>
            );
          }
          return (
            <Tabs defaultValue={examples[0].languageSlug}>
              <TabsList>
                {examples.map((ex) => (
                  <TabsTrigger key={ex.languageSlug} value={ex.languageSlug}>
                    {ex.languageName}
                  </TabsTrigger>
                ))}
              </TabsList>
              {examples.map((ex) => (
                <TabsContent key={ex.languageSlug} value={ex.languageSlug}>
                  <CodeBlock code={ex.code} />
                  {ex.explanation && <p className="mt-2 text-sm text-muted-foreground">{ex.explanation}</p>}
                </TabsContent>
              ))}
            </Tabs>
          );
        })()}
      </Section>

      <Section title="Common mistake">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          {lesson.commonMistake}
        </div>
      </Section>

      {lesson.microChecks.length > 0 && (
        <Section title="Check your understanding">
          <div className="flex flex-col gap-3">
            {lesson.microChecks.map((check, i) => (
              <MicroCheckWidget key={check.id} check={check} index={i} />
            ))}
          </div>
        </Section>
      )}

      {lesson.keyTakeaways.length > 0 && (
        <Section title="Key takeaways">
          <ul className="flex flex-col gap-1.5">
            {lesson.keyTakeaways.map((point) => (
              <li key={point} className="flex gap-2 text-sm">
                <span className="text-brand">✓</span>
                {point}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {lesson.nextProblem && (
        <motion.div {...fadeInUp}>
          <Section title="Apply it">
            <Link
              href={`/practice/${lesson.nextProblem.slug}`}
              className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted"
            >
              <div>
                <p className="text-sm font-medium">{lesson.nextProblem.title}</p>
                <p className="text-xs text-muted-foreground">Apply what you just learned</p>
              </div>
              <Badge variant="secondary" className="capitalize">
                {lesson.nextProblem.difficulty}
              </Badge>
            </Link>
          </Section>
        </motion.div>
      )}

      <div className="mt-4 flex items-center justify-between border-t pt-6">
        {lesson.previousLesson ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/learn/${lesson.previousLesson.moduleSlug}/${lesson.previousLesson.lessonSlug}`}>
              <ArrowLeft />
              {lesson.previousLesson.title}
            </Link>
          </Button>
        ) : (
          <span />
        )}
        <Button onClick={handleComplete} disabled={isCompleting || status === "completed"}>
          {status === "completed" ? "Completed" : isCompleting ? "Saving…" : "Mark complete & continue"}
          {status !== "completed" && <ArrowRight />}
        </Button>
      </div>
    </motion.div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-code-surface p-4 font-mono text-sm leading-relaxed">
      <code>{code}</code>
    </pre>
  );
}
