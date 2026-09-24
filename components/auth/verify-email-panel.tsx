"use client";

import { useActionState, useState } from "react";
import { resendVerificationEmail, type AuthActionResult } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

const initialState: AuthActionResult = { error: null };

export function VerifyEmailPanel({ email }: { email: string | null }) {
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [state, formAction, isPending] = useActionState(
    async (_prev: AuthActionResult, formData: FormData) => resendVerificationEmail(formData),
    initialState,
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {email ? (
          <>
            We sent a verification link to <span className="font-medium text-foreground">{email}</span>. Click it to
            finish setting up your account.
          </>
        ) : (
          "Check your email for a verification link to finish setting up your account."
        )}
      </p>
      {email && (
        <form action={formAction} onSubmit={() => setHasSubmitted(true)} className="flex flex-col gap-2">
          <input type="hidden" name="email" value={email} />
          <Button type="submit" variant="outline" disabled={isPending}>
            {isPending ? "Sending…" : "Resend verification email"}
          </Button>
          {hasSubmitted && !isPending && state.error === null && (
            <p className="text-sm text-muted-foreground">Verification email sent.</p>
          )}
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        </form>
      )}
    </div>
  );
}
