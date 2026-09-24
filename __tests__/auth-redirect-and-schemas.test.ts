import { describe, expect, it } from "vitest";
import { isSafeRelativePath } from "@/lib/auth/redirect";
import { onboardingSchema, updatePasswordSchema, loginSchema, requestPasswordResetSchema } from "@/lib/validation/schemas";

describe("isSafeRelativePath — open redirect protection", () => {
  it("accepts a plain relative path", () => {
    expect(isSafeRelativePath("/problem/binary-search")).toBe(true);
  });

  it("accepts a relative path with a query string", () => {
    expect(isSafeRelativePath("/practice?filter=hard")).toBe(true);
  });

  it("rejects an absolute external URL", () => {
    expect(isSafeRelativePath("https://evil.com")).toBe(false);
  });

  it("rejects a protocol-relative URL (open redirect via //)", () => {
    expect(isSafeRelativePath("//evil.com")).toBe(false);
  });

  it("rejects any value containing a scheme, even embedded in a query string — conservative by design", () => {
    expect(isSafeRelativePath("/redirect?to=https://evil.com")).toBe(false);
    expect(isSafeRelativePath("https://evil.com/../../learn")).toBe(false);
  });

  it("rejects null, undefined, and empty string", () => {
    expect(isSafeRelativePath(null)).toBe(false);
    expect(isSafeRelativePath(undefined)).toBe(false);
    expect(isSafeRelativePath("")).toBe(false);
  });

  it("rejects a path that doesn't start with a slash", () => {
    expect(isSafeRelativePath("learn")).toBe(false);
  });
});

describe("loginSchema", () => {
  it("rejects an invalid email", () => {
    expect(loginSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });

  it("accepts valid credentials shape", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "anything" }).success).toBe(true);
  });
});

describe("requestPasswordResetSchema", () => {
  it("rejects an invalid email", () => {
    expect(requestPasswordResetSchema.safeParse({ email: "nope" }).success).toBe(false);
  });

  it("accepts a valid email", () => {
    expect(requestPasswordResetSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
  });
});

describe("updatePasswordSchema", () => {
  it("rejects mismatched confirmation", () => {
    const result = updatePasswordSchema.safeParse({ password: "longenoughpw", confirmPassword: "different" });
    expect(result.success).toBe(false);
  });

  it("rejects a too-short password", () => {
    expect(updatePasswordSchema.safeParse({ password: "short", confirmPassword: "short" }).success).toBe(false);
  });

  it("accepts matching, long-enough passwords", () => {
    expect(updatePasswordSchema.safeParse({ password: "longenoughpw", confirmPassword: "longenoughpw" }).success).toBe(true);
  });
});

describe("onboardingSchema", () => {
  it("rejects an unknown primary language", () => {
    const result = onboardingSchema.safeParse({
      displayName: "Ada",
      primaryLanguageSlug: "javascript", // not one of the onboarding-offered languages
      experienceLevel: "beginner",
      learningGoal: "learn_programming",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing display name", () => {
    const result = onboardingSchema.safeParse({
      displayName: "",
      primaryLanguageSlug: "python",
      experienceLevel: "beginner",
      learningGoal: "learn_programming",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a fully-filled valid submission", () => {
    const result = onboardingSchema.safeParse({
      displayName: "Ada",
      primaryLanguageSlug: "python",
      experienceLevel: "complete_beginner",
      learningGoal: "master_dsa",
    });
    expect(result.success).toBe(true);
  });
});
