import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";

// proxy.ts already redirects unauthenticated requests away from these routes
// (see PROTECTED_ROUTE_PREFIXES in lib/auth/session.ts). This check is a
// defense-in-depth backstop, not the primary gate.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  if (!profile.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  return (
    <div className="flex flex-1">
      <AppSidebar />
      <div className="flex flex-1 flex-col">
        <AppHeader profile={profile} />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
