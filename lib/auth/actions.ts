"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import {
  loginSchema,
  requestPasswordResetSchema,
  signUpSchema,
  updatePasswordSchema,
  onboardingSchema,
} from "@/lib/validation/schemas";
import { isSafeRelativePath } from "@/lib/auth/redirect";
import { requireEmailVerification } from "@/lib/auth/config";
import type { AuthError } from "@supabase/supabase-js";

export interface AuthActionResult {
  error: string | null;
}

/**
 * Every branch here maps a real Supabase Auth error code to a
 * human-readable message — see ERROR HANDLING: "Never show stack traces,
 * SQL errors, raw Supabase JSON." Falls back to a generic message for
 * anything unmapped rather than leaking the raw error text.
 */
function mapAuthError(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Email or password is incorrect.";
    case "email_not_confirmed":
      return "Please verify your email before continuing.";
    case "user_already_exists":
    case "email_exists":
      return "This email is already registered.";
    case "weak_password":
      return "Please choose a stronger password.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Please wait a moment and try again.";
    case "validation_failed":
      return "Please check your information and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

/**
 * Public signup creates a STUDENT profile only — the `profiles` table
 * defaults `role` to 'student' (db/schema/002_roles_and_profiles.sql) and
 * RLS forbids a user from ever changing their own role (012_rls.sql).
 * MENTOR/ADMIN accounts are granted out-of-band, never through this path.
 */
export async function signUp(formData: FormData): Promise<AuthActionResult> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    username: formData.get("username") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        display_name: parsed.data.fullName,
        ...(parsed.data.username ? { username: parsed.data.username } : {}),
      },
    },
  });

  if (error) {
    return { error: mapAuthError(error) };
  }

  // GoTrue deliberately returns 200 with no error and an empty identities
  // array for an already-registered, already-confirmed email — anti
  // account-enumeration behavior, not a bug. This is the one reliable way
  // to detect "this email is already registered" from signUp() itself.
  if (data.user && data.user.identities?.length === 0) {
    return { error: "This email is already registered." };
  }

  // See lib/auth/config.ts. When verification isn't required AND the auth
  // backend actually agrees (it returned a real session — never assumed),
  // skip straight to onboarding. If the backend still required
  // confirmation despite the flag, data.session is null and this falls
  // through to the real verification flow instead of pretending the user
  // is signed in — see EMAIL VERIFICATION CHANGE: "do not fake
  // verification status."
  if (!requireEmailVerification() && data.session) {
    redirect("/onboarding");
  }

  redirect(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function login(formData: FormData): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const nextRaw = formData.get("next")?.toString() ?? null;
  const destination = isSafeRelativePath(nextRaw) ? nextRaw : "/home";

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: mapAuthError(error) };
  }

  redirect(destination);
}

export async function logout(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function requestPasswordReset(formData: FormData): Promise<AuthActionResult> {
  const parsed = requestPasswordResetSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email);

  // Always report success — never reveal whether an email is registered.
  if (error) {
    console.error("[auth] resetPasswordForEmail failed", error.message);
  }
  return { error: null };
}

export async function updatePassword(formData: FormData): Promise<AuthActionResult> {
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return { error: mapAuthError(error) };
  }

  // Sign out of the one-time recovery session so the user logs in fresh
  // with the new password — see PASSWORD RESET: "After successful reset:
  // → /login with: Password updated successfully."
  await supabase.auth.signOut();
  redirect("/login?resetSuccess=true");
}

export async function resendVerificationEmail(formData: FormData): Promise<AuthActionResult> {
  const email = formData.get("email")?.toString();
  if (!email) {
    return { error: "Missing email address." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });

  if (error) {
    return { error: mapAuthError(error) };
  }
  return { error: null };
}

/**
 * Onboarding stores preferences/goals only — see ONBOARDING: "Do NOT use
 * onboarding answers as fake mastery." Nothing here writes to
 * skill_mastery or any Prompt 4 table.
 */
export async function completeOnboarding(formData: FormData): Promise<AuthActionResult> {
  const parsed = onboardingSchema.safeParse({
    displayName: formData.get("displayName"),
    primaryLanguageSlug: formData.get("primaryLanguageSlug"),
    experienceLevel: formData.get("experienceLevel"),
    learningGoal: formData.get("learningGoal"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please fill in every field." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session has expired. Please log in again." };
  }

  const { data: language } = await supabase
    .from("languages")
    .select("id")
    .eq("slug", parsed.data.primaryLanguageSlug)
    .maybeSingle();

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      preferred_language_id: language?.id ?? null,
      experience_level: parsed.data.experienceLevel,
      learning_goal: parsed.data.learningGoal,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { error: "Couldn't save your preferences. Please try again." };
  }

  redirect("/home");
}
