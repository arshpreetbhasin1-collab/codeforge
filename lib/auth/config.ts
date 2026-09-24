import "server-only";

/**
 * Whether a new signup must confirm their email before entering the app —
 * see AUTH ARCHITECTURE / EMAIL VERIFICATION CHANGE.
 *
 * This is a SERVER-only decision (the `server-only` import above makes it
 * a build error to import this into client code) — it is never sent to
 * the browser, never read from a request, and never something a client
 * can toggle. It exists purely to select which of two REAL, already-
 * built server flows `signUp()` takes; it never fabricates a session or
 * marks an email confirmed on its own.
 *
 * IMPORTANT: this flag must stay in sync with the actual Supabase Auth
 * (GoTrue) backend's own confirmation setting — that backend is the true
 * source of truth for whether signUp() returns a session immediately:
 *   - Self-hosted GoTrue: GOTRUE_MAILER_AUTOCONFIRM=true/false
 *   - Supabase Cloud: Authentication > Providers > Email > "Confirm email"
 * Flipping only this app-side flag without also flipping the backend
 * setting will not change what GoTrue actually does — signUp() gracefully
 * falls back to the verification flow if the backend still requires it
 * (see lib/auth/actions.ts's signUp()), so a mismatch degrades safely
 * rather than silently granting unverified access.
 *
 * Defaults to NOT requiring verification — see EMAIL VERIFICATION CHANGE:
 * "The default development/deployment configuration for now should allow
 * signup without mandatory email verification." Set
 * AUTH_REQUIRE_EMAIL_VERIFICATION=true (and enable confirmation on the
 * Auth backend itself) to turn mandatory verification back on for a
 * production launch once transactional email is configured reliably.
 */
export function requireEmailVerification(): boolean {
  return process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === "true";
}
