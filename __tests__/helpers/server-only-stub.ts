// Stub for the `server-only` package in the Vitest environment — that
// package throws unconditionally outside Next.js's build, since it relies
// on webpack/Turbopack to strip it from client bundles. Vitest runs in
// plain Node, so alias it to a no-op (see vitest.config.ts).
export {};
