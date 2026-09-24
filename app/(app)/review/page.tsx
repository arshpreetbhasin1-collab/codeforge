import type { Metadata } from "next";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { getReviewQueue } from "@/services/learner/get-review-queue";
import { ReviewQueueList } from "@/components/learning/review-queue-list";

export const metadata: Metadata = { title: "Review Queue — CodeForge" };

export default async function ReviewPage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return <p className="text-muted-foreground">Sign in to see your review queue.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const items = await getReviewQueue(supabase, profile.id);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your review queue</h1>
        <p className="mt-1 text-muted-foreground">Skills that need another look, based on your real recent activity.</p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing to review right now — nice work.</p>
      ) : (
        <ReviewQueueList items={items} />
      )}
    </div>
  );
}
