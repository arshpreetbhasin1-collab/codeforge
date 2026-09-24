import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Sign up — CodeForge" };

export default function SignupPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
      <SignupForm />
    </div>
  );
}
