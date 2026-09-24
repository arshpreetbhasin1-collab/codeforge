import { describe, expect, it } from "vitest";
import {
  codeSubmissionSchema,
  learningEventTypeSchema,
  problemSchema,
  recordLessonProgressSchema,
  recordProblemProgressSchema,
  signUpSchema,
  skillSchema,
  submitMicroCheckAttemptSchema,
} from "@/lib/validation/schemas";
import { getLanguageBySlug } from "@/lib/problems/language-registry";

describe("problemSchema", () => {
  it("accepts a well-formed problem", () => {
    const result = problemSchema.safeParse({
      slug: "pair-sum-finder",
      title: "Pair Sum Finder",
      statement: "Given a list of integers, find the pair that sums to a target.",
      difficulty: "easy",
      learningObjective: "Understand constant-time average lookup.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an uppercase or spaced slug", () => {
    const result = problemSchema.safeParse({
      slug: "Pair Sum Finder",
      title: "Pair Sum Finder",
      statement: "Given a list of integers, find the pair that sums to a target.",
      difficulty: "easy",
      learningObjective: "Understand constant-time average lookup.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid difficulty", () => {
    const result = problemSchema.safeParse({
      slug: "pair-sum-finder",
      title: "Pair Sum Finder",
      statement: "Given a list of integers, find the pair that sums to a target.",
      difficulty: "impossible",
      learningObjective: "Understand constant-time average lookup.",
    });
    expect(result.success).toBe(false);
  });
});

describe("skillSchema", () => {
  it("rejects a difficulty outside 1-5", () => {
    const result = skillSchema.safeParse({
      slug: "arrays",
      name: "Arrays",
      description: "Storing and indexing ordered collections.",
      category: "data_structures",
      difficulty: 9,
    });
    expect(result.success).toBe(false);
  });
});

describe("codeSubmissionSchema", () => {
  it("rejects an unsupported language slug", () => {
    const result = codeSubmissionSchema.safeParse({
      problemId: "00000000-0000-0000-0000-000000000000",
      languageSlug: "cobol",
      sourceCode: "print('hi')",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty source code", () => {
    const result = codeSubmissionSchema.safeParse({
      problemId: "00000000-0000-0000-0000-000000000000",
      languageSlug: "python",
      sourceCode: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("signUpSchema", () => {
  it("rejects a short password", () => {
    const result = signUpSchema.safeParse({
      fullName: "Student One",
      email: "student@example.com",
      password: "short",
      confirmPassword: "short",
      username: "student",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid username", () => {
    const result = signUpSchema.safeParse({
      fullName: "Student One",
      email: "student@example.com",
      password: "longenoughpassword",
      confirmPassword: "longenoughpassword",
      username: "Not Valid!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched password confirmation", () => {
    const result = signUpSchema.safeParse({
      fullName: "Student One",
      email: "student@example.com",
      password: "longenoughpassword",
      confirmPassword: "somethingelse",
      username: "student_01",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid signup input without a username (optional)", () => {
    const result = signUpSchema.safeParse({
      fullName: "Student One",
      email: "student@example.com",
      password: "longenoughpassword",
      confirmPassword: "longenoughpassword",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid signup input", () => {
    const result = signUpSchema.safeParse({
      fullName: "Student One",
      email: "student@example.com",
      password: "longenoughpassword",
      confirmPassword: "longenoughpassword",
      username: "student_01",
    });
    expect(result.success).toBe(true);
  });
});

describe("learningEventTypeSchema", () => {
  it("accepts the Prompt 2 curriculum event types", () => {
    for (const type of [
      "lesson_started",
      "micro_check_started",
      "micro_check_completed",
      "problem_started",
      "problem_attempted",
      "problem_completed",
    ]) {
      expect(learningEventTypeSchema.safeParse(type).success).toBe(true);
    }
  });

  it("rejects an unknown event type", () => {
    expect(learningEventTypeSchema.safeParse("problem_deleted").success).toBe(false);
  });
});

describe("recordLessonProgressSchema", () => {
  it("rejects a non-uuid lesson id", () => {
    const result = recordLessonProgressSchema.safeParse({ lessonId: "not-a-uuid", status: "completed" });
    expect(result.success).toBe(false);
  });

  it("rejects a status outside in_progress/completed", () => {
    const result = recordLessonProgressSchema.safeParse({
      lessonId: "00000000-0000-0000-0000-000000000000",
      status: "abandoned",
    });
    expect(result.success).toBe(false);
  });
});

describe("recordProblemProgressSchema", () => {
  it("rejects a status of 'passed' — problem progress is attempted/completed, not a grading verdict", () => {
    const result = recordProblemProgressSchema.safeParse({
      problemId: "00000000-0000-0000-0000-000000000000",
      status: "passed",
    });
    expect(result.success).toBe(false);
  });
});

describe("submitMicroCheckAttemptSchema", () => {
  it("rejects an empty selected answer", () => {
    const result = submitMicroCheckAttemptSchema.safeParse({
      microCheckId: "00000000-0000-0000-0000-000000000000",
      selectedAnswer: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("language relationships", () => {
  it("keeps the executable-language schema in sync with the content registry for every language wired up this phase", () => {
    for (const slug of ["python", "c", "cpp", "java", "sql"]) {
      expect(getLanguageBySlug(slug)).toBeDefined();
      expect(codeSubmissionSchema.shape.languageSlug.safeParse(slug).success).toBe(true);
    }
  });

  it("rejects execution requests for a content-only language not wired up this phase", () => {
    // JavaScript exists in the content registry (Prompt 2 lesson examples)
    // but isn't one of the five languages executed this phase — see
    // lib/execution/registry.ts.
    expect(getLanguageBySlug("javascript")).toBeDefined();
    expect(codeSubmissionSchema.shape.languageSlug.safeParse("javascript").success).toBe(false);
  });
});
