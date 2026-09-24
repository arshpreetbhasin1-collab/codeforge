import { describe, expect, it } from "vitest";
import { checkRateLimit, type RateLimitConfig } from "@/lib/security/rate-limit";

const config: RateLimitConfig = { maxRequests: 3, windowMs: 60_000 };
const now = new Date("2026-01-01T00:01:00Z");

describe("checkRateLimit", () => {
  it("allows requests under the limit", () => {
    const timestamps = [new Date("2026-01-01T00:00:30Z"), new Date("2026-01-01T00:00:40Z")];
    const result = checkRateLimit(timestamps, now, config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it("blocks once the window is full", () => {
    const timestamps = [
      new Date("2026-01-01T00:00:10Z"),
      new Date("2026-01-01T00:00:20Z"),
      new Date("2026-01-01T00:00:30Z"),
    ];
    const result = checkRateLimit(timestamps, now, config);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("ignores requests outside the window", () => {
    const timestamps = [
      new Date("2025-12-31T23:00:00Z"), // over an hour ago — outside a 60s window
      new Date("2025-12-31T23:00:01Z"),
      new Date("2025-12-31T23:00:02Z"),
    ];
    const result = checkRateLimit(timestamps, now, config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(3);
  });

  it("retryAfterMs reflects when the oldest in-window request ages out", () => {
    const timestamps = [
      new Date("2026-01-01T00:00:30Z"),
      new Date("2026-01-01T00:00:40Z"),
      new Date("2026-01-01T00:00:50Z"),
    ];
    const result = checkRateLimit(timestamps, now, config);
    // oldest (00:00:30) + 60s window = 00:01:30, now is 00:01:00 -> 30s left
    expect(result.retryAfterMs).toBe(30_000);
  });
});
