import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { getPracticeProblems, getPracticeSections, type ProblemSummary } from "@/services/learning/get-practice-problems";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, ChevronLeft, ChevronRight } from "lucide-react";
import type { ProblemDifficulty, ProblemKind } from "@/types/domain";

export const metadata: Metadata = { title: "Practice — CodeForge" };

const DIFFICULTIES: { value: ProblemDifficulty; label: string }[] = [
  { value: "intro", label: "Beginner" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
];

const PROBLEM_TYPES: { value: ProblemKind; label: string }[] = [
  { value: "implementation", label: "Implementation" },
  { value: "debugging", label: "Debugging" },
  { value: "output_prediction", label: "Output prediction" },
  { value: "code_completion", label: "Code completion" },
  { value: "edge_case_reasoning", label: "Edge cases" },
];

interface PracticePageProps {
  searchParams: Promise<{ skill?: string; difficulty?: string; type?: string; page?: string }>;
}

export default async function PracticePage({ searchParams }: PracticePageProps) {
  const params = await searchParams;
  const profile = await getCurrentProfile();
  const supabase = await createSupabaseServerClient();

  const hasFilters = Boolean(params.skill || params.difficulty || params.type);
  const page = Number(params.page) > 0 ? Number(params.page) : 1;

  const { data: skills } = await supabase.from("skills").select("slug, name").order("name", { ascending: true });

  if (hasFilters) {
    const result = await getPracticeProblems(
      supabase,
      profile?.id ?? null,
      {
        skillSlug: params.skill,
        difficulty: params.difficulty as ProblemDifficulty | undefined,
        problemType: params.type as ProblemKind | undefined,
      },
      page,
    );

    return (
      <div className="flex flex-col gap-6">
        <PageHeader />
        <FilterBar skills={skills ?? []} active={params} />
        <ProblemList problems={result.problems} emptyLabel="No problems match these filters." />
        <Pagination page={result.page} pageSize={result.pageSize} totalCount={result.totalCount} params={params} />
      </div>
    );
  }

  const sections = await getPracticeSections(supabase, profile?.id ?? null);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader />
      <FilterBar skills={skills ?? []} active={params} />

      {sections.continuePractice.length > 0 && (
        <PracticeSection title="Continue practice" problems={sections.continuePractice} />
      )}
      <PracticeSection
        title="Recommended for you"
        problems={sections.recommended}
        emptyLabel="No problems seeded yet. Run db/seed/seed.sql against a connected Supabase project."
      />
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Practice</h1>
      <p className="mt-1 text-muted-foreground">What should you solve next?</p>
    </div>
  );
}

function PracticeSection({
  title,
  problems,
  emptyLabel,
}: {
  title: string;
  problems: ProblemSummary[];
  emptyLabel?: string;
}) {
  return (
    <div>
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      <ProblemList problems={problems} emptyLabel={emptyLabel} />
    </div>
  );
}

function ProblemList({ problems, emptyLabel }: { problems: ProblemSummary[]; emptyLabel?: string }) {
  if (problems.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel ?? "Nothing here yet."}</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {problems.map((problem) => (
        <Link key={problem.id} href={`/practice/${problem.slug}`}>
          <Card className="h-full transition-colors hover:bg-muted/50">
            <CardContent className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{problem.title}</p>
                {problem.status === "completed" ? (
                  <CheckCircle2 className="size-4 shrink-0 text-brand" />
                ) : (
                  <Circle className="size-4 shrink-0 text-muted-foreground/30" />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="text-xs capitalize">
                  {problem.difficulty === "intro" ? "beginner" : problem.difficulty}
                </Badge>
                {problem.skillNames.slice(0, 2).map((name) => (
                  <Badge key={name} variant="outline" className="text-xs">
                    {name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function FilterBar({
  skills,
  active,
}: {
  skills: { slug: string; name: string }[];
  active: { skill?: string; difficulty?: string; type?: string };
}) {
  return (
    <div className="flex flex-col gap-2">
      <FilterRow
        label="Difficulty"
        options={DIFFICULTIES.map((d) => ({ value: d.value, label: d.label }))}
        activeValue={active.difficulty}
        paramKey="difficulty"
        otherParams={active}
      />
      <FilterRow
        label="Type"
        options={PROBLEM_TYPES}
        activeValue={active.type}
        paramKey="type"
        otherParams={active}
      />
      {skills.length > 0 && (
        <FilterRow
          label="Skill"
          options={skills.map((s) => ({ value: s.slug, label: s.name }))}
          activeValue={active.skill}
          paramKey="skill"
          otherParams={active}
        />
      )}
    </div>
  );
}

function FilterRow({
  label,
  options,
  activeValue,
  paramKey,
  otherParams,
}: {
  label: string;
  options: { value: string; label: string }[];
  activeValue?: string;
  paramKey: "skill" | "difficulty" | "type";
  otherParams: { skill?: string; difficulty?: string; type?: string };
}) {
  function hrefFor(value?: string) {
    const next = { ...otherParams, [paramKey]: value };
    const search = new URLSearchParams();
    if (next.skill) search.set("skill", next.skill);
    if (next.difficulty) search.set("difficulty", next.difficulty);
    if (next.type) search.set("type", next.type);
    const qs = search.toString();
    return `/practice${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      <span className="mr-1 text-xs font-medium text-muted-foreground">{label}</span>
      <Link
        href={hrefFor(undefined)}
        className={cn(
          "rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-muted",
          !activeValue && "border-brand bg-brand/10 text-brand",
        )}
      >
        All
      </Link>
      {options.map((option) => (
        <Link
          key={option.value}
          href={hrefFor(option.value)}
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs capitalize transition-colors hover:bg-muted",
            activeValue === option.value && "border-brand bg-brand/10 text-brand",
          )}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}

function Pagination({
  page,
  pageSize,
  totalCount,
  params,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  params: { skill?: string; difficulty?: string; type?: string };
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalPages <= 1) return null;

  function hrefFor(targetPage: number) {
    const search = new URLSearchParams();
    if (params.skill) search.set("skill", params.skill);
    if (params.difficulty) search.set("difficulty", params.difficulty);
    if (params.type) search.set("type", params.type);
    search.set("page", String(targetPage));
    return `/practice?${search.toString()}`;
  }

  const isFirstPage = page <= 1;
  const isLastPage = page >= totalPages;

  return (
    <div className="flex items-center justify-between">
      <Button asChild variant="outline" size="sm" className={cn(isFirstPage && "pointer-events-none opacity-50")}>
        <Link href={hrefFor(page - 1)} aria-disabled={isFirstPage} tabIndex={isFirstPage ? -1 : undefined}>
          <ChevronLeft />
          Previous
        </Link>
      </Button>
      <span className="text-xs text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <Button asChild variant="outline" size="sm" className={cn(isLastPage && "pointer-events-none opacity-50")}>
        <Link href={hrefFor(page + 1)} aria-disabled={isLastPage} tabIndex={isLastPage ? -1 : undefined}>
          Next
          <ChevronRight />
        </Link>
      </Button>
    </div>
  );
}
