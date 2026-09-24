import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";

export const metadata: Metadata = { title: "Set a new password — CodeForge" };

export default async function ResetPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold tracking-tight">This link has expired</h1>
        <p className="text-sm text-muted-foreground">
          Password reset links only work for a short time. Request a new one below.
        </p>
        <Link href="/forgot-password" className="text-sm underline">
          Request a new reset link
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Set a new password</h1>
      </div>
      <ResetPasswordForm />
    </div>
  );
}
