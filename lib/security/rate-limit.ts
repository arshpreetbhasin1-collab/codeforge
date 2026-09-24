/**
 * Pure rate-limit-window logic — see EXECUTION COST / ABUSE PROTECTION.
 * Callers supply real recent-request timestamps (queried from
 * code_runs/submissions); this function only does the counting, so it's
 * testable without a database or a clock mock.
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitCheck {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number | null;
}

export function checkRateLimit(recentTimestamps: Date[], now: Date, config: RateLimitConfig): RateLimitCheck {
  const windowStart = now.getTime() - config.windowMs;
  const withinWindow = recentTimestamps.filter((t) => t.getTime() > windowStart);

  if (withinWindow.length < config.maxRequests) {
    return { allowed: true, remaining: config.maxRequests - withinWindow.length, retryAfterMs: null };
  }

  const oldestInWindow = withinWindow.reduce((min, t) => (t.getTime() < min.getTime() ? t : min));
  const retryAfterMs = oldestInWindow.getTime() + config.windowMs - now.getTime();

  return { allowed: false, remaining: 0, retryAfterMs: Math.max(retryAfterMs, 0) };
}

/** Run: fast feedback, so a more generous window. */
export const RUN_RATE_LIMIT: RateLimitConfig = { maxRequests: 15, windowMs: 60_000 };

/** Submit: an official attempt, tighter — also protects the free public execution backends from abuse. */
export const SUBMIT_RATE_LIMIT: RateLimitConfig = { maxRequests: 8, windowMs: 60_000 };

export const MAX_SOURCE_CODE_LENGTH = 20_000;
