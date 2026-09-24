"use client";

import { useActionState, useState } from "react";
import { completeOnboarding, type AuthActionResult } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ExperienceLevel, LearningGoal } from "@/types/domain";

const initialState: AuthActionResult = { error: null };

const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string }[] = [
  { value: "complete_beginner", label: "Complete beginner" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const GOAL_OPTIONS: { value: LearningGoal; label: string }[] = [
  { value: "learn_programming", label: "Learn programming" },
  { value: "master_dsa", label: "Master DSA" },
  { value: "interview_prep", label: "Prepare for interviews" },
  { value: "improve_problem_solving", label: "Improve problem solving" },
  { value: "build_projects", label: "Build projects" },
];

interface LanguageOption {
  slug: string;
  displayName: string;
}

export function OnboardingForm({ languages, defaultName }: { languages: LanguageOption[]; defaultName: string }) {
  const [primaryLanguageSlug, setPrimaryLanguageSlug] = useState<string | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(null);
  const [learningGoal, setLearningGoal] = useState<LearningGoal | null>(null);

  const [state, formAction, isPending] = useActionState(
    async (_prev: AuthActionResult, formData: FormData) => completeOnboarding(formData),
    initialState,
  );

  const canSubmit = primaryLanguageSlug !== null && experienceLevel !== null && learningGoal !== null;

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="displayName">What should we call you?</Label>
        <Input id="displayName" name="displayName" defaultValue={defaultName} required maxLength={100} />
      </div>

      <div className="flex flex-col gap-2">
        <Label>What do you want to learn?</Label>
        <input type="hidden" name="primaryLanguageSlug" value={primaryLanguageSlug ?? ""} />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {languages.map((lang) => (
            <OptionButton
              key={lang.slug}
              selected={primaryLanguageSlug === lang.slug}
              onClick={() => setPrimaryLanguageSlug(lang.slug)}
            >
              {lang.displayName}
            </OptionButton>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>What&apos;s your experience level?</Label>
        <input type="hidden" name="experienceLevel" value={experienceLevel ?? ""} />
        <div className="grid grid-cols-2 gap-2">
          {EXPERIENCE_OPTIONS.map((opt) => (
            <OptionButton key={opt.value} selected={experienceLevel === opt.value} onClick={() => setExperienceLevel(opt.value)}>
              {opt.label}
            </OptionButton>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>What&apos;s your main goal?</Label>
        <input type="hidden" name="learningGoal" value={learningGoal ?? ""} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {GOAL_OPTIONS.map((opt) => (
            <OptionButton key={opt.value} selected={learningGoal === opt.value} onClick={() => setLearningGoal(opt.value)}>
              {opt.label}
            </OptionButton>
          ))}
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={isPending || !canSubmit} className="self-start">
        {isPending ? "Saving…" : "Start learning"}
      </Button>
    </form>
  );
}

function OptionButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
        selected ? "border-brand bg-brand/10 font-medium" : "border-border hover:bg-muted/50",
      )}
    >
      {children}
    </button>
  );
}
