# CodeForge

Don't memorize code. Build the ability to solve.

CodeForge is an adaptive developer-learning platform, built to be a better alternative to LeetCode. Instead of just handing out problems and checking pass/fail, it follows a full pipeline from language and skill assessment through a personalized curriculum, concept explanations, micro challenges, coding problems, code execution, test evaluation, code quality analysis, an AI mentor, mistake analysis, adaptive problem selection, mastery tracking, real projects, GitHub integration, deployment, project verification, and interview simulation. The product optimizes for understanding, not problem count. Every progress metric is meant to be traceable to a real learning_events row (see db/schema/007_progress_and_mastery.sql).

## Core philosophy

The platform is built around six pillars: learn, solve, understand failure, adapt, build, and prove. Every feature in the product belongs to at least one of these.

## Tech stack

The frontend runs on Next.js 16 with the App Router, Turbopack, and TypeScript (Next 16 renamed middleware.js to proxy.js, so this repo uses proxy.ts). Styling is Tailwind CSS v4 with shadcn/ui (radix-nova preset), Radix primitives, and Lucide icons. Component interactions use Motion, with shared tokens in lib/motion/tokens.ts; GSAP is planned for the landing page and scroll-driven sequences but isn't wired up yet. The backend is built on Next.js Server Actions and Route Handlers, with Supabase (PostgreSQL plus Supabase Auth via @supabase/ssr) for the database and auth layer. Input validation runs through Zod v4, forms use React Hook Form where they need more than native FormData, and tests run on Vitest.

## Architecture

The app directory is organized into route groups for auth and the main app, plus the marketing root page. components/ui holds the shadcn/ui primitives, with app-specific composed components split across auth, layout, editor, learning, dashboard, skill-graph, problems, and projects folders. lib/auth handles session logic, server actions, and role checks; lib/db holds the Supabase clients for browser, server, and admin contexts; lib/validation is the trust boundary with Zod schemas for all input; lib/learning contains the skill graph and learning path logic as pure functions; lib/problems holds the language registry; lib/ai is the AI provider abstraction and per-capability functions; lib/motion centralizes motion tokens. On the services side, services/learning is the only write path to learning_events, services/mastery calculates skill mastery, and services/projects, services/mistakes, services/recommendations, and services/execution handle their respective domains. types/domain.ts holds hand-written domain types and types/database.ts mirrors the Supabase schema. db/schema holds the numbered SQL migrations that are the source of truth for the schema, and db/seed has small, original development fixtures. __tests__ has the Vitest unit tests for all of the above. Business logic never lives inside React components; components call into lib/ and services/ instead.

## Database architecture

The full, commented schema lives in db/schema/*.sql and covers roles and profiles, languages, the skill graph, curriculum, problems, submissions, learning events, mastery, projects, interviews, achievements, notifications, AI conversations, and GitHub/deployment tracking. Every table uses UUID primary keys, foreign keys, indexes, and created_at/updated_at timestamps. Row Level Security is enabled everywhere in db/schema/012_rls.sql: content tables are publicly readable and staff-writable, while user-owned tables like submissions, learning_events, and skill_mastery are readable and writable only by their owner or staff. Hidden test cases are never selectable by students directly. The problems table carries learning objectives, expected complexity, common-mistake detection hints, and a graded hint ladder rather than just a title, description, and answer (see db/schema/005_problems.sql). To apply the schema to a real Supabase project, run the files in db/schema/ in numeric order through the Supabase SQL editor or CLI, then run db/seed/seed.sql.

## Authentication

Auth runs on Supabase Auth through lib/auth/actions.ts, covering signup, login, logout, password reset, and session persistence via cookies (lib/db/supabase-server.ts), with route protection handled in proxy.ts, which redirects unauthenticated requests away from the protected route prefixes defined in lib/auth/session.ts. Roles are student, mentor, or admin, stored on profiles.role. Public signup can only ever create a student profile, enforced both by the column default in db/schema/002_roles_and_profiles.sql and by an RLS update policy in 012_rls.sql that rejects any attempt by a user to change their own role. Server-side role gates live in lib/auth/current-user.ts, backed by pure, unit-tested logic in lib/auth/authorize.ts.

## Learning engine

The skill graph in lib/learning/skill-graph.ts handles pure graph operations over skills and their dependencies: prerequisites, unlocking, cycle detection, and topological ordering. The learning path logic in lib/learning/path.ts combines the skill graph with a student's mastery scores to recommend the next skill. Mastery calculation in services/mastery takes correctness, difficulty, hints used, independence, and complexity into account rather than a naive solved-over-total ratio, with decay and confidence scoring layered on top in lib/mastery. Learning events are recorded through services/learning/record-learning-event.ts, the single write path to the learning_events table, which acts as the append-only log every progress metric is traceable back to.

## Language and execution architecture

lib/problems/language-registry.ts mirrors the languages table, seeded with Python, JavaScript, and Java. Execution strategy is per-language rather than assumed uniform, and the actual sandboxed code execution runs through a Wandbox-based provider in lib/execution, with the judge in lib/judge comparing output against expected test cases and producing verdicts.

## AI architecture

lib/ai/provider.ts defines the AI provider interface. Six capability-specific functions live in lib/ai/capabilities.ts covering the mentor, hints, code review, explanations, the interviewer, and project review, rather than one catch-all "ask AI" function. The hint capability implements a progressive multi-level ladder, from a clarifying question up to a full explanation, so the AI can never skip straight to the answer.

## Security notes

Every Server Action input is validated with Zod through lib/validation/schemas.ts; client input is never trusted directly. lib/db/supabase-admin.ts uses the service-role key, bypasses RLS, and is marked server-only so it can never be imported into client code. No AI or database secret is read outside a server context (see .env.local.example). Rate limiting lives in lib/security/rate-limit.ts and SQL inputs used in the SQL practice sandbox are validated in lib/security/sql-validator.ts before execution.

## Local setup

Run npm install, then copy .env.local.example to .env.local and fill in a real Supabase project's values, then run npm run dev. Without a real Supabase project, the app still builds and runs: auth pages render and submit, but calls to Supabase fail gracefully instead of crashing, and the dashboard falls back to an empty or onboarding state.

## Environment variables

See .env.local.example for the full list. The required ones are NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, and NEXT_PUBLIC_SITE_URL.

## Development commands

npm run dev starts the dev server with Turbopack, npm run build creates a production build, npm run lint runs ESLint, npm run typecheck runs tsc --noEmit, and npm run test runs the Vitest suite.

## Project status

CodeForge is an active, in-progress project. The foundation is in place: architecture, database schema, authentication, the learning engine core, code execution and judging, the mastery and mistake-tracking systems, project-based learning with AI coaching, and the recommendation engine. Still on the roadmap: a polished AI interview simulator and debugging mode, a full GitHub integration and deployment pipeline for student portfolios, further UI/UX polish with richer motion and gamification, and a broader security and accessibility audit ahead of a public launch.
