import type { ResourceLimits } from "./types";

/**
 * The execution-specific language registry — separate from
 * lib/problems/language-registry.ts (Prompt 1's content-oriented
 * registry, which also lists languages like JavaScript that exist for
 * lesson examples but aren't wired for real execution yet). This is the
 * single source of truth for "which languages actually run code this
 * phase" — see LANGUAGE REGISTRY: "Do not hardcode language behavior
 * across React components."
 *
 * SQL is deliberately not a Wandbox-style stdin/stdout runtime — see
 * services/execution/sql-sandbox.ts. It still gets an entry here so the
 * Monaco language switcher and starter-code lookup have one consistent
 * table to read from.
 */
export type ExecutableLanguageSlug = "python" | "c" | "cpp" | "java" | "sql";

export interface ExecutableLanguageConfig {
  slug: ExecutableLanguageSlug;
  displayName: string;
  fileExtension: string;
  monacoLanguage: string;
  /** Opaque identifier passed to the execution provider. Null for SQL (its own sandbox, not Wandbox). */
  providerLanguageId: string | null;
  compileRequired: boolean;
  defaultLimits: ResourceLimits;
  starterCode: string;
  /** Shown under the starter code when the provider imposes a real constraint on how code must be written. */
  starterCodeNote: string | null;
}

const OUTPUT_LIMIT_BYTES = 64 * 1024;

export const EXECUTABLE_LANGUAGES: readonly ExecutableLanguageConfig[] = [
  {
    slug: "python",
    displayName: "Python",
    fileExtension: ".py",
    monacoLanguage: "python",
    providerLanguageId: "cpython-3.12.7",
    compileRequired: false,
    defaultLimits: { timeLimitMs: 2000, memoryLimitMb: 128, outputLimitBytes: OUTPUT_LIMIT_BYTES },
    starterCode: "def solve():\n    # your code here\n    pass\n\nsolve()\n",
    starterCodeNote: null,
  },
  {
    slug: "c",
    displayName: "C",
    fileExtension: ".c",
    monacoLanguage: "c",
    providerLanguageId: "gcc-13.2.0-c",
    compileRequired: true,
    defaultLimits: { timeLimitMs: 2000, memoryLimitMb: 128, outputLimitBytes: OUTPUT_LIMIT_BYTES },
    starterCode: "#include <stdio.h>\n\nint main(void) {\n    // your code here\n    return 0;\n}\n",
    starterCodeNote: null,
  },
  {
    slug: "cpp",
    displayName: "C++",
    fileExtension: ".cpp",
    monacoLanguage: "cpp",
    providerLanguageId: "gcc-13.2.0",
    compileRequired: true,
    defaultLimits: { timeLimitMs: 2000, memoryLimitMb: 128, outputLimitBytes: OUTPUT_LIMIT_BYTES },
    starterCode:
      "#include <iostream>\nusing namespace std;\n\nint main() {\n    // your code here\n    return 0;\n}\n",
    starterCodeNote: null,
  },
  {
    slug: "java",
    displayName: "Java",
    fileExtension: ".java",
    monacoLanguage: "java",
    providerLanguageId: "openjdk-jdk-21+35",
    compileRequired: true,
    defaultLimits: { timeLimitMs: 3000, memoryLimitMb: 256, outputLimitBytes: OUTPUT_LIMIT_BYTES },
    starterCode: "class Main {\n    public static void main(String[] args) {\n        // your code here\n    }\n}\n",
    starterCodeNote:
      "The class is not declared public — the execution environment always compiles a fixed prog.java file, which only non-public top-level classes are compatible with.",
  },
  {
    slug: "sql",
    displayName: "SQL",
    fileExtension: ".sql",
    monacoLanguage: "sql",
    providerLanguageId: null,
    compileRequired: false,
    defaultLimits: { timeLimitMs: 2000, memoryLimitMb: 64, outputLimitBytes: OUTPUT_LIMIT_BYTES },
    starterCode: "SELECT\n    -- your columns\nFROM\n    -- your tables\n;\n",
    starterCodeNote: "Read-only: only SELECT / WITH queries are allowed — see SQL SECURITY.",
  },
] as const;

export function getExecutableLanguage(slug: string): ExecutableLanguageConfig | undefined {
  return EXECUTABLE_LANGUAGES.find((l) => l.slug === slug);
}

export function isExecutableLanguage(slug: string): slug is ExecutableLanguageSlug {
  return EXECUTABLE_LANGUAGES.some((l) => l.slug === slug);
}
