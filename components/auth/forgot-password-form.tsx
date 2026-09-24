"use client";

import { useActionState, useState } from "react";
import { requestPasswordReset, type AuthActionResult } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionResult = { error: null };

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);
  const [state, formAction, isPending] = useActionState(
    async (_prev: AuthActionResult, formData: FormData) => requestPasswordReset(formData),
    initialState,
  );

  if (submitted && !isPending && !state.error) {
    return <p className="text-sm text-muted-foreground">Check your email for a password reset link.</p>;
  }

  return (
    <form action={formAction} onSubmit={() => setSubmitted(true)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={isPending} className="mt-2">
        {isPending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
