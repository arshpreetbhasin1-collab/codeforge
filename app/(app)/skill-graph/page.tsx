import type { Metadata } from "next";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { getSkillGraph } from "@/services/learner/get-skill-graph";
import { SkillGraphView } from "@/components/learning/skill-graph-view";

export const metadata: Metadata = { title: "Skill Graph — CodeForge" };

export default async function SkillGraphPage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Skill Graph</h1>
        <p className="text-muted-foreground">Sign in to see your skill map.</p>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const nodes = await getSkillGraph(supabase, profile.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Skill Graph</h1>
        <p className="mt-1 text-muted-foreground">Every skill, its prerequisites, and your real mastery — computed from your submissions.</p>
      </div>
      {nodes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Not enough data yet — the skill graph will appear once skills are seeded.</p>
      ) : (
        <SkillGraphView nodes={nodes} />
      )}
    </div>
  );
}
