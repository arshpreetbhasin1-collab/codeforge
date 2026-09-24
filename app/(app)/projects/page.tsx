import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentProfile } from "@/lib/auth/current-user";
import {
  getProjectCatalog,
  getProjectCatalogSections,
  type ProjectCard,
  type ProjectCatalogSort,
} from "@/services/projects/get-project-catalog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import type { ProjectDifficulty } from "@/types/domain";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Projects — CodeForge" };

const DIFFICULTIES: { value: ProjectDifficulty; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const SORTS: { value: ProjectCatalogSort; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "newest", label: "Newest" },
  { value: "difficulty", label: "Difficulty" },
];

interface ProjectsPageProps {
  searchParams: Promise<{ difficulty?: string; language?: string; q?: string; sort?: string; page?: string }>;
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const params = await searchParams;
  const profile = await getCurrentProfile();

  if (!profile) {
    return <ComingSoon title="Projects" description="Sign in to see project readiness for your skills." prompt="Prompt 7" />;
  }

  const supabase = await createSupabaseServerClient();
  const hasFilters = Boolean(params.difficulty || params.language || params.q);
  const page = Number(params.page) > 0 ? Number(params.page) : 1;
  const sort = (params.sort as ProjectCatalogSort) || "recommended";

  const [{ data: languages }, { count: publishedProjectCount }] = await Promise.all([
    supabase.from("languages").select("slug, display_name").order("sort_order", { ascending: true }),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("is_published", true),
  ]);

  if (hasFilters) {
    const result = await getProjectCatalog(
      supabase,
      profile.id,
      { difficulty: params.difficulty as ProjectDifficulty | undefined, languageSlug: params.language, query: params.q },
      sort,
      page,
    );

    return (
      <div className="flex flex-col gap-6">
        <PageHeader />
        <FilterBar languages={languages ?? []} active={params} />
        <ProjectGrid projects={result.projects} emptyLabel="No projects match these filters." />
        <Pagination page={result.page} pageSize={result.pageSize} totalCount={result.totalCount} params={params} />
      </div>
    );
  }

  const sections = await getProjectCatalogSections(supabase, profile.id);
  const noProjectsSeeded = (publishedProjectCount ?? 0) === 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader />
      <FilterBar languages={languages ?? []} active={params} />

      {sections.inProgress.length > 0 && <ProjectSection title="In progress" projects={sections.inProgress} />}
      {sections.featured.length > 0 && <ProjectSection title="Featured" projects={sections.featured} />}
      <ProjectSection
        title="Recommended for you"
        projects={sections.recommended}
        emptyLabel={
          noProjectsSeeded
            ? "No projects seeded yet. Run db/seed/seed.sql against a connected Supabase project."
            : "No project is close to ready yet — keep building skill mastery and one will show up here with a specific reason why."
        }
      />
      {sections.completed.length > 0 && <ProjectSection title="Completed" projects={sections.completed} />}
      {!noProjectsSeeded && sections.inProgress.length === 0 && sections.featured.length === 0 && sections.recommended.length === 0 && sections.completed.length === 0 && (
        <ProjectSection title="All projects" projects={sections.all} />
      )}
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
      <p className="mt-1 text-muted-foreground">Real-world builds, unlocked as your skills reach the level they need.</p>
    </div>
  );
}

function ProjectSection({ title, projects, emptyLabel }: { title: string; projects: ProjectCard[]; emptyLabel?: string }) {
  return (
    <div>
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      <ProjectGrid projects={projects} emptyLabel={emptyLabel} />
    </div>
  );
}

function ProjectGrid({ projects, emptyLabel }: { projects: ProjectCard[]; emptyLabel?: string }) {
  if (projects.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel ?? "Nothing here yet."}</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCardTile key={project.id} project={project} />
      ))}
    </div>
  );
}

function ProjectCardTile({ project }: { project: ProjectCard }) {
  const completed = project.progressVerdict === "passed";
  const inProgress = project.progressVerdict === "in_progress";

  return (
    <Link href={`/projects/${project.slug}`}>
      <Card className="h-full transition-colors hover:bg-muted/50">
        <CardContent className="flex h-full flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium">{project.title}</p>
            {completed && <CheckCircle2 className="size-4 shrink-0 text-brand" />}
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">{project.description}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="text-xs capitalize">
              {project.difficulty}
            </Badge>
            {project.estimatedHours !== null && (
              <Badge variant="outline" className="text-xs">
                ~{project.estimatedHours}h
              </Badge>
            )}
            {project.languageSlugs.slice(0, 3).map((slug) => (
              <Badge key={slug} variant="outline" className="text-xs uppercase">
                {slug}
              </Badge>
            ))}
          </div>
          <div className="mt-auto flex flex-col gap-1 pt-2">
            {!completed && (
              <>
                <Progress value={Math.round(project.readinessScore * 100)} className="h-1.5" />
                <p className="text-xs text-muted-foreground">{inProgress ? "Continue building" : project.explanation}</p>
              </>
            )}
            {completed && <p className="text-xs text-brand">Completed</p>}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function FilterBar({
  languages,
  active,
}: {
  languages: { slug: string; display_name: string }[];
  active: { difficulty?: string; language?: string; q?: string; sort?: string };
}) {
  return (
    <div className="flex flex-col gap-2">
      <FilterRow
        label="Difficulty"
        options={DIFFICULTIES}
        activeValue={active.difficulty}
        paramKey="difficulty"
        otherParams={active}
      />
      {languages.length > 0 && (
        <FilterRow
          label="Language"
          options={languages.map((l) => ({ value: l.slug, label: l.display_name }))}
          activeValue={active.language}
          paramKey="language"
          otherParams={active}
        />
      )}
      <FilterRow label="Sort" options={SORTS} activeValue={active.sort} paramKey="sort" otherParams={active} />
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
  paramKey: "difficulty" | "language" | "sort";
  otherParams: { difficulty?: string; language?: string; q?: string; sort?: string };
}) {
  function hrefFor(value?: string) {
    const next = { ...otherParams, [paramKey]: value };
    const search = new URLSearchParams();
    if (next.difficulty) search.set("difficulty", next.difficulty);
    if (next.language) search.set("language", next.language);
    if (next.q) search.set("q", next.q);
    if (next.sort) search.set("sort", next.sort);
    const qs = search.toString();
    return `/projects${qs ? `?${qs}` : ""}`;
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
  params: { difficulty?: string; language?: string; q?: string; sort?: string };
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalPages <= 1) return null;

  function hrefFor(targetPage: number) {
    const search = new URLSearchParams();
    if (params.difficulty) search.set("difficulty", params.difficulty);
    if (params.language) search.set("language", params.language);
    if (params.q) search.set("q", params.q);
    if (params.sort) search.set("sort", params.sort);
    search.set("page", String(targetPage));
    return `/projects?${search.toString()}`;
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
