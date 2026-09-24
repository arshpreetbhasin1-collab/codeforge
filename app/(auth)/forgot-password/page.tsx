import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password — CodeForge" };

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Reset your password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We&apos;ll email you a link to set a new password.
        </p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
