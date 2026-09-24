import { describe, expect, it } from "vitest";
import {
  getEnabledLanguages,
  getExecutionProvider,
  getLanguageBySlug,
  requiresCompileStep,
} from "@/lib/problems/language-registry";

describe("language registry", () => {
  it("finds a known language by slug", () => {
    expect(getLanguageBySlug("python")?.displayName).toBe("Python");
  });

  it("returns undefined for an unknown language", () => {
    expect(getLanguageBySlug("cobol")).toBeUndefined();
  });

  it("returns only enabled languages, sorted by sortOrder", () => {
    const enabled = getEnabledLanguages();
    expect(enabled.every((l) => l.enabled)).toBe(true);
    const sortOrders = enabled.map((l) => l.sortOrder);
    expect(sortOrders).toEqual([...sortOrders].sort((a, b) => a - b));
  });

  it("does not assume every language shares a compile step", () => {
    const python = getLanguageBySlug("python")!;
    const java = getLanguageBySlug("java")!;
    expect(requiresCompileStep(python)).toBe(false);
    expect(requiresCompileStep(java)).toBe(true);
  });

  it("resolves an execution provider for a known language", () => {
    expect(getExecutionProvider("python")).toBe("wandbox");
  });

  it("throws for an unknown language's execution provider", () => {
    expect(() => getExecutionProvider("cobol")).toThrow();
  });
});
