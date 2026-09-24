/**
 * Recomputes mistake_events and skill_mastery from already-persisted
 * submission history — a real maintenance utility (e.g. after a formula
 * change in lib/mastery or lib/mistakes), not a one-off. Safe to re-run:
 * classification is skipped for submissions that already have a
 * mistake_events row, and mastery recalculation is idempotent by design
 * (see services/mastery/recalculate-skill-mastery.ts).
 *
 * Run with:
 *   NODE_OPTIONS="--conditions=react-server" npx tsx --env-file=.env.local scripts/backfill-mastery.ts
 *
 * The --conditions=react-server flag makes Node resolve the `server-only`
 * package to its no-op react-server export instead of throwing — the
 * same export condition Next.js's RSC bundler uses, not a hack around it.
 */
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { classifyAndRecordMistake } from "@/services/mistakes/classify-and-record-mistake";
import { buildEvidenceFromSubmission } from "@/services/mistakes/build-evidence-from-submission";
import { recalculateSkillMastery, getSkillIdsTaughtByProblem } from "@/services/mastery/recalculate-skill-mastery";

async function main() {
  const admin = createSupabaseAdminClient();

  const { data: submissions, error: submissionsError } = await admin
    .from("submissions")
    .select("id, user_id, problem_id, status")
    .not("status", "in", "(queued,running,cancelled)");

  if (submissionsError) throw new Error(`Failed to load submissions: ${submissionsError.message}`);

  const { data: existingEvents } = await admin.from("mistake_events").select("submission_id");
  const alreadyClassified = new Set((existingEvents ?? []).map((e) => e.submission_id as string));

  let classifiedCount = 0;
  let skippedCount = 0;
  const categoryTotals = new Map<string, number>();

  for (const submission of submissions ?? []) {
    if (alreadyClassified.has(submission.id as string)) {
      skippedCount += 1;
      continue;
    }

    const reconstructed = await buildEvidenceFromSubmission(admin, submission.id as string);
    if (!reconstructed) continue;

    const classification = await classifyAndRecordMistake(admin, {
      userId: reconstructed.userId,
      submissionId: submission.id as string,
      problemId: reconstructed.problemId,
      evidence: reconstructed.evidence,
    });

    if (classification) {
      classifiedCount += 1;
      categoryTotals.set(classification.category, (categoryTotals.get(classification.category) ?? 0) + 1);
    }
  }

  const userProblemPairs = new Map<string, Set<string>>();
  for (const submission of submissions ?? []) {
    const problems = userProblemPairs.get(submission.user_id as string) ?? new Set<string>();
    problems.add(submission.problem_id as string);
    userProblemPairs.set(submission.user_id as string, problems);
  }

  let skillsRecalculated = 0;
  for (const [userId, problemIds] of userProblemPairs) {
    const skillIds = new Set<string>();
    for (const problemId of problemIds) {
      for (const skillId of await getSkillIdsTaughtByProblem(admin, problemId)) skillIds.add(skillId);
    }
    for (const skillId of skillIds) {
      await recalculateSkillMastery(admin, userId, skillId);
      skillsRecalculated += 1;
    }
  }

  console.log(`Submissions scanned: ${submissions?.length ?? 0}`);
  console.log(`Already classified (skipped): ${skippedCount}`);
  console.log(`Newly classified: ${classifiedCount}`);
  for (const [category, count] of categoryTotals) console.log(`  ${category}: ${count}`);
  console.log(`Skill mastery rows recalculated: ${skillsRecalculated} (across ${userProblemPairs.size} learner(s))`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
