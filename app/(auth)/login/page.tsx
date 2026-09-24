import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { isSafeRelativePath } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Log in — CodeForge" };

const LINK_ERROR_MESSAGE: Record<string, string> = {
  invalid_link: "That link isn't valid. Please request a new one.",
  expired_link: "That link has expired. Please request a new one.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; resetSuccess?: string }>;
}) {
  const params = await searchParams;
  const next = isSafeRelativePath(params.next) ? params.next : undefined;
  const linkError = params.error ? LINK_ERROR_MESSAGE[params.error] : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Welcome back.</h1>
      </div>
      {params.resetSuccess && (
        <p className="rounded-md bg-brand/10 px-3 py-2 text-sm text-foreground">
          Password updated successfully.
        </p>
      )}
      {linkError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{linkError}</p>}
      <LoginForm next={next} />
    </div>
  );
}
