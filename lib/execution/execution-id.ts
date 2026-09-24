/**
 * Short id shown to the user on a system error, so it can be referenced
 * without exposing any internal detail — see OBSERVABILITY / ERROR
 * HANDLING: "Execution ID: EXE-7F3A92".
 */
export function generateExecutionId(): string {
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `EXE-${random}`;
}
