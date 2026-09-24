import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";

/**
 * The one server-side landing point for every email-based auth link —
 * signup confirmation, password recovery, invite, email change. GoTrue
 * (see gotrue.env's GOTRUE_MAILER_URLPATHS_*) sends the browser here with
 * `token` + `type` (the value is a token *hash*, despite the query param's
 * name — GoTrue's default mail templates predate the `token_hash` naming)
 * rather than embedding a session in the URL, so verification happens
 * entirely server-side via verifyOtp() — no client JS required to
 * establish the session. See AUTH ARCHITECTURE: "Authentication must be
 * server-authoritative."
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL("/login?error=invalid_link", origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    const reason = error.message.toLowerCase().includes("expired") ? "expired_link" : "invalid_link";
    return NextResponse.redirect(new URL(`/login?error=${reason}`, origin));
  }

  // Recovery links land the user on the "set a new password" page;
  // everything else (signup, invite, email change confirmation) is a
  // brand-new or freshly-changed identity — send it through onboarding,
  // which is a no-op redirect to /home if onboarding is already complete.
  return NextResponse.redirect(new URL(type === "recovery" ? "/reset-password" : "/onboarding", origin));
}
