import { z } from "zod";

/**
 * Zod schemas for every payload that crosses a trust boundary (Server
 * Action input, Route Handler body). Never trust client input — see
 * SECURITY FOUNDATION. Validate here, not just in the browser form.
 */

export const learningEventTypeSchema = z.enum([
  "lesson_viewed",
  "lesson_started",
  "lesson_completed",
  "micro_check_started",
  "micro_check_completed",
  "challenge_started",
  "problem_started",
  "problem_attempted",
  "problem_completed",
  "submission_created",
  "submission_passed",
  "submission_failed",
  "hint_requested",
  "solution_viewed",
  "concept_reviewed",
  "problem_abandoned",
  "boss_started",
  "boss_completed",
  "project_started",
  "project_completed",
  "project_stage_started",
  "project_stage_completed",
  "project_test_run",
  "project_submitted",
  "project_passed",
  "project_failed",
  "project_reviewed",
  "interview_started",
  "interview_completed",
  "compilation_mistake",
  "runtime_mistake",
  "efficiency_mistake",
  "logic_mistake",
  "skill_mastery_updated",
]);

export const recordLearningEventSchema = z.object({
  eventType: learningEventTypeSchema,
  skillId: z.uuid().nullable().optional(),
  problemId: z.uuid().nullable().optional(),
  lessonId: z.uuid().nullable().optional(),
  submissionId: z.uuid().nullable().optional(),
  projectId: z.uuid().nullable().optional(),
  projectSubmissionId: z.uuid().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type RecordLearningEventInput = z.infer<typeof recordLearningEventSchema>;

export const problemDifficultySchema = z.enum(["intro", "easy", "medium", "hard", "boss"]);

export const problemKindSchema = z.enum([
  "implementation",
  "debugging",
  "output_prediction",
  "algorithm_selection",
  "complexity_analysis",
  "code_completion",
  "refactoring",
  "edge_case_reasoning",
]);

export const problemSchema = z.object({
  slug: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase, alphanumeric, and hyphen-separated"),
  title: z.string().min(3).max(120),
  statement: z.string().min(20),
  difficulty: problemDifficultySchema,
  problemType: problemKindSchema.default("implementation"),
  progressionLevel: z.number().int().min(1).max(5).default(1),
  learningObjective: z.string().min(10),
  constraints: z.string().max(2000).nullable().optional(),
  expectedTimeComplexity: z.string().max(40).nullable().optional(),
  expectedSpaceComplexity: z.string().max(40).nullable().optional(),
  isBossChallenge: z.boolean().default(false),
});

export type ProblemInput = z.infer<typeof problemSchema>;

export const microCheckTypeSchema = z.enum(["multiple_choice", "predict_output", "conceptual"]);

export const submitMicroCheckAttemptSchema = z.object({
  microCheckId: z.uuid(),
  selectedAnswer: z.string().min(1).max(500),
});

export type SubmitMicroCheckAttemptInput = z.infer<typeof submitMicroCheckAttemptSchema>;

export const recordLessonProgressSchema = z.object({
  lessonId: z.uuid(),
  status: z.enum(["in_progress", "completed"]),
});

export type RecordLessonProgressInput = z.infer<typeof recordLessonProgressSchema>;

export const recordProblemProgressSchema = z.object({
  problemId: z.uuid(),
  status: z.enum(["attempted", "completed"]),
});

export type RecordProblemProgressInput = z.infer<typeof recordProblemProgressSchema>;

export const skillCategorySchema = z.enum([
  "foundations",
  "control_flow",
  "functions",
  "data_structures",
  "algorithms",
  "complexity",
  "debugging",
  "system_design",
  "databases",
  "web",
  "testing",
]);

export const skillSchema = z.object({
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(80),
  description: z.string().min(10),
  category: skillCategorySchema,
  languageId: z.uuid().nullable().optional(),
  difficulty: z.number().int().min(1).max(5),
});

export type SkillInput = z.infer<typeof skillSchema>;

export const languageSlugSchema = z.enum(["python", "javascript", "typescript", "java", "c", "cpp", "sql"]);

/**
 * The five languages actually wired for execution this phase — see
 * lib/execution/registry.ts. Deliberately narrower than languageSlugSchema
 * (content language slugs), so an execution request for e.g. "javascript"
 * is rejected at the validation boundary, not deep inside the provider.
 */
export const executableLanguageSlugSchema = z.enum(["python", "c", "cpp", "java", "sql"]);

export const codeSubmissionSchema = z.object({
  problemId: z.uuid(),
  languageSlug: executableLanguageSlugSchema,
  sourceCode: z.string().min(1).max(20_000),
});

export type CodeSubmissionInput = z.infer<typeof codeSubmissionSchema>;

export const codeRunSchema = z.object({
  problemId: z.uuid().nullable().optional(),
  languageSlug: executableLanguageSlugSchema,
  sourceCode: z.string().min(1).max(20_000),
  stdin: z.string().max(10_000).optional(),
});

export type CodeRunInput = z.infer<typeof codeRunSchema>;

export const projectStageSubmissionSchema = z.object({
  projectId: z.uuid(),
  stageId: z.uuid(),
  languageSlug: executableLanguageSlugSchema,
  sourceCode: z.string().min(1).max(20_000),
});

export type ProjectStageSubmissionInput = z.infer<typeof projectStageSubmissionSchema>;

export const projectStageRunSchema = z.object({
  projectId: z.uuid(),
  stageId: z.uuid(),
  languageSlug: executableLanguageSlugSchema,
  sourceCode: z.string().min(1).max(20_000),
});

export type ProjectStageRunInput = z.infer<typeof projectStageRunSchema>;

export const projectHintRequestSchema = z.object({
  projectId: z.uuid(),
  stageId: z.uuid(),
  languageSlug: executableLanguageSlugSchema,
  sourceCode: z.string().max(20_000),
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  question: z.string().min(1).max(500),
});

export type ProjectHintRequestInput = z.infer<typeof projectHintRequestSchema>;

// ---------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------

export const signUpSchema = z
  .object({
    fullName: z.string().min(1, "Please enter your name.").max(100),
    email: z.email("Please enter a valid email."),
    password: z.string().min(8, "Password must be at least 8 characters.").max(72),
    confirmPassword: z.string().min(1),
    username: z
      .union([
        z
          .string()
          .min(3)
          .max(32)
          .regex(/^[a-z0-9_-]+$/, "Username must be lowercase letters, numbers, - or _."),
        z.literal(""),
      ])
      .optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type SignUpInput = z.infer<typeof signUpSchema>;

export const loginSchema = z.object({
  email: z.email("Please enter a valid email."),
  password: z.string().min(1, "Please enter your password."),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const requestPasswordResetSchema = z.object({
  email: z.email("Please enter a valid email."),
});

export const updatePasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters.").max(72),
    confirmPassword: z.string().min(1),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const onboardingSchema = z.object({
  displayName: z.string().min(1, "Please tell us what to call you.").max(100),
  primaryLanguageSlug: z.enum(["python", "c", "cpp", "java", "sql"]),
  experienceLevel: z.enum(["complete_beginner", "beginner", "intermediate", "advanced"]),
  learningGoal: z.enum(["learn_programming", "master_dsa", "interview_prep", "improve_problem_solving", "build_projects"]),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
