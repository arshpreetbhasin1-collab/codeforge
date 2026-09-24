/**
 * Validates a "return to this page after auth" destination — see
 * PROTECTED ROUTES: "Validate the next destination. Never allow an open
 * redirect." A value like `https://evil.com` or `//evil.com` must never
 * be honored just because it showed up in a query param.
 */
export function isSafeRelativePath(value: string | null | undefined): value is string {
  if (!value) return false;
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false; // protocol-relative — resolves to an external origin
  if (value.includes("://")) return false;
  return true;
}
