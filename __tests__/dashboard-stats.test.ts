import { describe, expect, it } from "vitest";
import { computeStreak } from "@/services/learner/get-dashboard-stats";

const TODAY = new Date("2026-06-10T15:00:00Z");

describe("computeStreak — real consecutive-day activity, never fabricated", () => {
  it("returns 0 with no activity at all", () => {
    expect(computeStreak(new Set(), TODAY)).toBe(0);
  });

  it("counts today plus consecutive prior days", () => {
    const dates = new Set(["2026-06-10", "2026-06-09", "2026-06-08"]);
    expect(computeStreak(dates, TODAY)).toBe(3);
  });

  it("still counts the streak through yesterday if today has no activity yet", () => {
    const dates = new Set(["2026-06-09", "2026-06-08"]);
    expect(computeStreak(dates, TODAY)).toBe(2);
  });

  it("stops counting at the first gap", () => {
    const dates = new Set(["2026-06-10", "2026-06-09", "2026-06-07"]); // gap on the 8th
    expect(computeStreak(dates, TODAY)).toBe(2);
  });

  it("returns 0 when the most recent activity was more than a day ago", () => {
    const dates = new Set(["2026-06-05"]);
    expect(computeStreak(dates, TODAY)).toBe(0);
  });
});
