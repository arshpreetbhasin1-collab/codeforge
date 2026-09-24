import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth/current-user";

const PILLARS = [
  { name: "Learn", description: "Understand a concept quickly." },
  { name: "Solve", description: "Apply the concept through coding." },
  { name: "Understand Failure", description: "Learn why a solution failed." },
  { name: "Adapt", description: "The curriculum changes with your weaknesses." },
  { name: "Build", description: "Apply knowledge to real projects." },
  { name: "Prove", description: "Demonstrate skills through code and interviews." },
];

// See AUTHENTICATED ROOT: an authenticated visitor must never land back on
// the marketing page — send them straight into the app (or onboarding if
// their profile isn't set up yet). A logged-out visitor still sees the
// real marketing page below, which already has its own Log in/Sign up CTAs.
export default async function LandingPage() {
  const profile = await getCurrentProfile();
  if (profile) {
    redirect(profile.onboardingCompletedAt ? "/home" : "/onboarding");
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <span className="font-mono text-sm font-semibold tracking-tight">CodeForge</span>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">Sign up</Link>
          </Button>
        </nav>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center md:px-10">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance md:text-5xl">
          Don&apos;t memorize code.
          <br />
          Build the ability to solve.
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground text-balance">
          CodeForge is an adaptive developer-learning platform — from your first programming
          concept to a job-ready software engineer.
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link href="/signup">
            Start learning
            <ArrowRight />
          </Link>
        </Button>

        <div className="mt-20 grid w-full max-w-4xl grid-cols-2 gap-6 text-left md:grid-cols-3">
          {PILLARS.map((pillar) => (
            <div key={pillar.name} className="rounded-lg border p-4">
              <h2 className="text-sm font-medium">{pillar.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{pillar.description}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="px-6 py-6 text-center text-xs text-muted-foreground md:px-10">
        CodeForge
      </footer>
    </div>
  );
}
