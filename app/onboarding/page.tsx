import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { OnboardingForm } from "@/components/auth/onboarding-form";

export const metadata: Metadata = { title: "Welcome — CodeForge" };

const ONBOARDING_LANGUAGE_SLUGS = ["python", "c", "cpp", "java", "sql"];

export default async function OnboardingPage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  if (profile.onboardingCompletedAt) {
    redirect("/home");
  }

  const supabase = await createSupabaseServerClient();
  const { data: languageRows } = await supabase
    .from("languages")
    .select("slug, display_name")
    .in("slug", ONBOARDING_LANGUAGE_SLUGS)
    .order("sort_order", { ascending: true });

  const languages = (languageRows ?? []).map((row) => ({ slug: row.slug as string, displayName: row.display_name as string }));

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to CodeForge 👋</h1>
        <p className="mt-1 text-muted-foreground">A few quick questions so we can tailor your path.</p>
      </div>
      <OnboardingForm languages={languages} defaultName={profile.displayName ?? ""} />
    </div>
  );
}
