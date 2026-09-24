/**
 * Core execution types — the contract every provider implements and every
 * judge/UI consumer reads. See EXECUTION ARCHITECTURE: providers never run
 * inside the Next.js process; this is the boundary between "the app" and
 * "an isolated runner somewhere else."
 */

export type ExecutionErrorCategory =
  | "compile_error"
  | "runtime_error"
  | "time_limit_exceeded"
  | "memory_limit_exceeded"
  | "output_limit_exceeded"
  | "system_error";

export interface ResourceLimits {
  timeLimitMs: number;
  memoryLimitMb: number;
  /** Max combined stdout+stderr bytes before OUTPUT_LIMIT_EXCEEDED. */
  outputLimitBytes: number;
}

export interface ExecutionRequest {
  /** provider_language_id from the languages table — opaque to callers. */
  providerLanguageId: string;
  sourceCode: string;
  stdin: string;
  limits: ResourceLimits;
}

export interface ExecutionResult {
  /**
   * Null when the process completed (even with a non-zero exit / runtime
   * error) — set only when the provider itself could not determine an
   * outcome (network failure, provider outage, etc.). See NO FAKE METRICS.
   */
  errorCategory: ExecutionErrorCategory | null;
  stdout: string;
  stderr: string;
  compileOutput: string | null;
  /**
   * Wall-clock milliseconds for the whole round trip, measured by this
   * process. Not a precise CPU-time figure — see WandoxExecutionProvider's
   * doc comment. Null only if truly unmeasured.
   */
  executionTimeMs: number | null;
  /** Never fabricated — null whenever the provider doesn't report it. */
  memoryUsedKb: number | null;
  exitCode: number | null;
  truncated: boolean;
  /** SQL only — used for result-table rendering, not judging (stdout carries the canonical comparable form). */
  sqlRows?: unknown[][];
  sqlColumns?: string[];
}

export const DEFAULT_OUTPUT_LIMIT_BYTES = 64 * 1024; // 64 KB
