import type { UserRole } from "@/types/domain";

/**
 * Pure authorization logic, kept separate from lib/auth/current-user.ts so
 * it's testable without a Supabase client or Next.js request context.
 */

export function hasRole(role: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(role);
}

export function isStaff(role: UserRole): boolean {
  return hasRole(role, ["admin", "mentor"]);
}

export function isAdmin(role: UserRole): boolean {
  return role === "admin";
}

/**
 * Public signup must never be able to mint a staff account — this is the
 * single source of truth for "what role can self-signup create," mirrored
 * by the `profiles.role` column default in db/schema/002_roles_and_profiles.sql
 * and enforced again at the database layer by RLS (012_rls.sql).
 */
export function defaultSignupRole(): UserRole {
  return "student";
}
