import "server-only";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { hasRole } from "@/lib/auth/authorize";
import type { Profile, UserRole, ExperienceLevel, LearningGoal } from "@/types/domain";

/** Row shape as stored (snake_case) — mapped to the camelCase `Profile` domain type. */
interface ProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  bio: string | null;
  preferred_language_id: string | null;
  timezone: string;
  onboarding_completed_at: string | null;
  experience_level: ExperienceLevel | null;
  learning_goal: LearningGoal | null;
  created_at: string;
  updated_at: string;
}

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    role: row.role,
    bio: row.bio,
    preferredLanguageId: row.preferred_language_id,
    timezone: row.timezone,
    onboardingCompletedAt: row.onboarding_completed_at,
    experienceLevel: row.experience_level,
    learningGoal: row.learning_goal,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  if (error || !data) return null;

  return mapProfile(data as ProfileRow);
}

/**
 * Server-side role gate. Throws rather than silently no-op'ing, so a
 * missing check fails loudly (500) instead of leaking staff-only data.
 * Client-side checks (hiding a nav link) are UX only — this is the boundary
 * that actually matters, backed by the RLS policies in
 * db/schema/012_rls.sql for data access.
 */
export async function requireRole(...allowedRoles: UserRole[]): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("Not authenticated.");
  }
  if (!hasRole(profile.role, allowedRoles)) {
    throw new Error(`Requires role: ${allowedRoles.join(" or ")}.`);
  }
  return profile;
}
