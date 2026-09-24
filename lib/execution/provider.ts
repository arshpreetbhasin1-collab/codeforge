import "server-only";
import type { ExecutionRequest, ExecutionResult } from "./types";
import { WandboxExecutionProvider } from "./providers/wandbox-provider";

/**
 * Every execution backend implements this. Never called from the browser —
 * always from a Server Action / Route Handler, and the concrete provider
 * always does its actual compiling/running on infrastructure other than
 * this Next.js process. See MOST IMPORTANT SECURITY RULE.
 */
export interface ExecutionProvider {
  readonly name: string;
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
}

/**
 * Selects the configured provider. Swapping providers (self-hosted
 * Wandbox, Piston, Judge0, a paid vendor) is a one-line change here, never
 * a change to callers — see PROVIDER CONFIGURATION.
 */
export function resolveExecutionProvider(): ExecutionProvider {
  // Only one provider exists today; this function is what makes adding a
  // second one (env-selected) not require touching call sites.
  return new WandboxExecutionProvider();
}
