/**
 * Sanitizes raw provider output before it ever reaches a client — see
 * COMPILE ERROR / RUNTIME ERROR: "Normalize compiler output... Do not
 * reveal filesystem paths, container internals, host details."
 */

// Wandbox's sandbox paths — see the verified compiler_error output in
// this prompt's research: "prog.cc: In function...", "/home/wandbox/prog.py".
const INFRA_PATH_PATTERNS: [RegExp, string][] = [
  [/\/home\/wandbox\/prog\.\w+/g, "your_program"],
  [/^prog\.\w+/gm, "your_program"],
  [/\bprog\.(c|cc|cpp|java|py)\b/g, "your_program.$1"],
];

export function sanitizeCompilerOutput(raw: string): string {
  let output = raw;
  for (const [pattern, replacement] of INFRA_PATH_PATTERNS) {
    output = output.replace(pattern, replacement);
  }
  return output;
}

export function sanitizeRuntimeOutput(raw: string): string {
  return sanitizeCompilerOutput(raw);
}

export interface TruncationResult {
  text: string;
  truncated: boolean;
}

export function truncateOutput(text: string, maxBytes: number): TruncationResult {
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes <= maxBytes) {
    return { text, truncated: false };
  }
  // Truncate by bytes, not characters, to stay correct with multi-byte UTF-8.
  const buffer = Buffer.from(text, "utf8").subarray(0, maxBytes);
  return { text: `${buffer.toString("utf8")}\n… (output truncated)`, truncated: true };
}
