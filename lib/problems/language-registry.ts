import type { ExecutionProvider, Language } from "@/types/domain";

/**
 * Static fallback registry, mirrored from db/seed/seed.sql. The database is
 * the source of truth once a Supabase project exists — this exists so UI
 * and validation code has a typed registry to work against before that's
 * wired up, and so tests don't need a live database.
 *
 * Execution strategy is intentionally NOT assumed to be uniform across
 * languages — Prompt 3's sandboxed runner reads `executionProvider` to
 * decide how to run a given language rather than branching on `slug`.
 */
export const LANGUAGE_REGISTRY: readonly Language[] = [
  {
    id: "python",
    slug: "python",
    displayName: "Python",
    version: "3.12",
    fileExtension: ".py",
    syntaxHighlighter: "python",
    executionProvider: "wandbox",
    compileCommand: null,
    runCommand: "python3 main.py",
    timeoutMs: 5000,
    memoryLimitMb: 256,
    enabled: true,
    sortOrder: 1,
    providerLanguageId: "cpython-3.12.7",
    executionEnabled: true,
  },
  {
    id: "javascript",
    slug: "javascript",
    displayName: "JavaScript",
    version: "Node 22",
    fileExtension: ".js",
    syntaxHighlighter: "javascript",
    executionProvider: "sandboxed_container",
    compileCommand: null,
    runCommand: "node main.js",
    timeoutMs: 5000,
    memoryLimitMb: 256,
    enabled: true,
    sortOrder: 2,
    providerLanguageId: null,
    executionEnabled: false,
  },
  {
    id: "java",
    slug: "java",
    displayName: "Java",
    version: "21",
    fileExtension: ".java",
    syntaxHighlighter: "java",
    executionProvider: "wandbox",
    compileCommand: "javac prog.java",
    runCommand: "java prog",
    timeoutMs: 8000,
    memoryLimitMb: 512,
    enabled: true,
    sortOrder: 3,
    providerLanguageId: "openjdk-jdk-21+35",
    executionEnabled: true,
  },
  {
    id: "c",
    slug: "c",
    displayName: "C",
    version: "GCC 13.2.0",
    fileExtension: ".c",
    syntaxHighlighter: "c",
    executionProvider: "wandbox",
    compileCommand: "gcc prog.c",
    runCommand: "./prog",
    timeoutMs: 5000,
    memoryLimitMb: 256,
    enabled: true,
    sortOrder: 4,
    providerLanguageId: "gcc-13.2.0-c",
    executionEnabled: true,
  },
  {
    id: "cpp",
    slug: "cpp",
    displayName: "C++",
    version: "GCC 13.2.0",
    fileExtension: ".cpp",
    syntaxHighlighter: "cpp",
    executionProvider: "wandbox",
    compileCommand: "g++ prog.cc",
    runCommand: "./prog",
    timeoutMs: 5000,
    memoryLimitMb: 256,
    enabled: true,
    sortOrder: 5,
    providerLanguageId: "gcc-13.2.0",
    executionEnabled: true,
  },
  {
    id: "sql",
    slug: "sql",
    displayName: "SQL",
    version: "PostgreSQL",
    fileExtension: ".sql",
    syntaxHighlighter: "sql",
    executionProvider: "sql_sandbox",
    compileCommand: null,
    runCommand: "isolated transaction (see services/execution/sql-sandbox.ts)",
    timeoutMs: 2000,
    memoryLimitMb: 64,
    enabled: true,
    sortOrder: 6,
    providerLanguageId: null,
    executionEnabled: true,
  },
] as const;

export function getLanguageBySlug(slug: string): Language | undefined {
  return LANGUAGE_REGISTRY.find((language) => language.slug === slug);
}

export function getEnabledLanguages(): Language[] {
  return LANGUAGE_REGISTRY.filter((language) => language.enabled).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

export function requiresCompileStep(language: Language): boolean {
  return language.compileCommand !== null;
}

export function getExecutionProvider(slug: string): ExecutionProvider {
  const language = getLanguageBySlug(slug);
  if (!language) {
    throw new Error(`Unknown language: ${slug}`);
  }
  return language.executionProvider;
}
