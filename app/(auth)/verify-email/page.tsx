import type { Metadata } from "next";
import { VerifyEmailPanel } from "@/components/auth/verify-email-panel";

export const metadata: Metadata = { title: "Verify your email — CodeForge" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Account created.</h1>
        <p className="mt-1 text-sm text-muted-foreground">Check your email to verify your CodeForge account.</p>
      </div>
      <VerifyEmailPanel email={email ?? null} />
    </div>
  );
}
