import { describe, expect, it } from "vitest";
import { defaultSignupRole, hasRole, isAdmin, isStaff } from "@/lib/auth/authorize";

describe("authorization", () => {
  it("grants access when the role is in the allowed list", () => {
    expect(hasRole("mentor", ["mentor", "admin"])).toBe(true);
  });

  it("denies access when the role is not in the allowed list", () => {
    expect(hasRole("student", ["mentor", "admin"])).toBe(false);
  });

  it("treats mentor and admin as staff, and student as not", () => {
    expect(isStaff("mentor")).toBe(true);
    expect(isStaff("admin")).toBe(true);
    expect(isStaff("student")).toBe(false);
  });

  it("treats only admin as admin", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("mentor")).toBe(false);
    expect(isAdmin("student")).toBe(false);
  });

  it("never lets public signup default to a staff role", () => {
    expect(defaultSignupRole()).toBe("student");
  });
});
