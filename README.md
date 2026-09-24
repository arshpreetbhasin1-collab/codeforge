# CodeForge

**Don't memorize code. Build the ability to solve.**

CodeForge is an adaptive developer-learning platform — not a LeetCode clone,
not a course site, not a chatbot wrapper. It's built around a specific
pipeline:

```
LANGUAGE → SKILL ASSESSMENT → PERSONALIZED CURRICULUM → ONE-PAGE CONCEPT
  → MICRO CHALLENGE → CODING PROBLEM → CODE EXECUTION → TEST EVALUATION
  → CODE QUALITY ANALYSIS → AI MENTOR → MISTAKE ANALYSIS → ADAPTIVE NEXT
  PROBLEM → MASTERY → BOSS CHALLENGE → REAL PROJECT → GITHUB → DEPLOYMENT
  → PROJECT VERIFICATION → INTERVIEW SIMULATION → ENGINEER READINESS
```

The product optimizes for **understanding**, not problem count. Every
progress metric is meant to be traceable to a real `learning_events` row —
see `db/schema/007_progress_and_mastery.sql`.

## Core philosophy — six pillars

**Learn** → **Solve** → **Understand Failure** → **Adapt** → **Build** →
**Prove**. Everything in the product belongs to at least one of these.

## Tech stack

- **Framework:** Next.js 16 (App Router, Turbopack, TypeScript). Next 16
  renamed `middleware.js` to `proxy.js` — this repo uses `proxy.ts`.
- **Styling:** Tailwind CSS v4 + shadcn/ui (radix-nova preset) + Radix
  primitives, Lucide icons.
- **Motion:** [Motion](https://motion.dev) for component interactions
  (`lib/motion/tokens.ts`). GSAP is reserved for Prompt 9 (landing page /
  scroll-driven sequences) — not used yet.
- **Backend:** Next.js Server Actions + Route Handlers.
- **Database / Auth:** Supabase (PostgreSQL + Supabase Auth via
  `@supabase/ssr`).
- **Validation:** Zod v4. **Forms:** React Hook Form (wired in as later
  prompts add non-trivial forms — auth forms currently use native FormData).
- **Testing:** Vitest.

## Architecture

```
/app                      Route groups: (auth) and (app), plus the marketing root page
/components/ui            shadcn/ui primitives
/components/{auth,layout} App-specific composed components
/components/{editor,learning,dashboard,skill-graph,problems,projects,ai}
                           Reserved for Prompts 2–9

/lib/auth                 Session handling, server actions, role checks
/lib/db                   Supabase clients (browser / server / admin)
/lib/validation           Zod schemas — the trust boundary for all input
/lib/learning              Skill graph + learning path logic (pure functions)
/lib/problems              Language registry
/lib/ai                    AI provider abstraction + per-capability functions
/lib/motion                Centralized motion tokens

/services/learning          Learning-event recording (the only write path to learning_events)
/services/mastery           calculateSkillMastery() — placeholder algorithm, real one in Prompt 4
/services/{evaluation,ai,projects}  Reserved for later prompts

/types                     domain.ts (hand-written types) + database.ts (Supabase-generated, placeholder for now)

/db/schema                 Numbered SQL migrations — source of truth for the schema
/db/seed                   Small, original development fixtures (not a content catalog)

/__tests__                 Vitest unit tests for the above
```

Business logic does not live inside React components — components call into
`lib/` and `services/`.

## Database architecture

See `db/schema/*.sql` for the full, commented schema (roles/profiles,
languages, skill graph, curriculum, problems, submissions, learning events,
mastery, projects, interviews, achievements, notifications, AI
conversations, GitHub/deployment). Highlights:

- Every table uses UUID primary keys, foreign keys, indexes, and
  `created_at`/`updated_at` timestamps.
- `db/schema/012_rls.sql` enables Row Level Security everywhere: content
  tables are publicly readable and staff-writable; user-owned tables
  (submissions, learning_events, skill_mastery, ...) are readable/writable
  only by their owner (or staff). Hidden test cases are never selectable by
  students directly.
- `problems` is not `{title, description, answer}` — it carries learning
  objectives, expected complexity, common-mistake detection hints, and a
  graded hint ladder (see `db/schema/005_problems.sql`).

To apply the schema to a real Supabase project, run the files in
`db/schema/` in numeric order via the Supabase SQL editor or CLI, then
`db/seed/seed.sql`.

## Authentication

Email/password auth via Supabase Auth (`lib/auth/actions.ts`):
signup, login, logout, password reset, session persistence via cookies
(`lib/db/supabase-server.ts`), and route protection via `proxy.ts` (which
redirects unauthenticated requests away from the protected route prefixes
in `lib/auth/session.ts`).

Roles are `student | mentor | admin` (`profiles.role`). **Public signup can
only ever create a `student` profile** — enforced twice: the column default
in `db/schema/002_roles_and_profiles.sql`, and an RLS `UPDATE` policy in
`012_rls.sql` that rejects any attempt by a user to change their own role.
Server-side role gates live in `lib/auth/current-user.ts`
(`requireRole(...)`), backed by pure, unit-tested logic in
`lib/auth/authorize.ts`.

## Learning engine (foundation)

- **Skill Graph:** `lib/learning/skill-graph.ts` — pure graph operations
  (prerequisites, unlocking, cycle detection, topological order) over
  `skills` + `skill_dependencies`.
- **Learning path:** `lib/learning/path.ts` — `recommendNextSkill()`
  combines the skill graph with a student's mastery scores. This is a
  naive default, not the real adaptive algorithm — Prompt 4 replaces it.
- **Mastery:** `services/mastery/calculate-skill-mastery.ts` — the
  `calculateSkillMastery()` interface every later prompt will call. Takes
  correctness, difficulty, hints used, independence, and complexity/edge
  cases into account; deliberately not `solved / total`.
- **Learning events:** `services/learning/record-learning-event.ts` is the
  single write path to `learning_events` — the append-only log every future
  progress metric must be traceable to.

## Language architecture

`lib/problems/language-registry.ts` mirrors the `languages` table (seeded
with Python, JavaScript, Java). Execution strategy is per-language
(`executionProvider`), not assumed uniform — Prompt 3 implements the actual
sandboxed runner against this abstraction. **No code execution happens
in this prompt.**

## AI architecture

`lib/ai/provider.ts` defines the `AiProvider` interface; no concrete
provider is wired up yet — calling it throws an explicit
"not configured" error rather than silently mocking a response. Six
capability-specific functions exist in `lib/ai/capabilities.ts` (mentor,
hint, code_review, explanation, interviewer, project_review) — not one
giant "ask AI" function. The hint capability implements the progressive
6-level ladder (clarifying question → full explanation) so the AI can never
skip straight to the answer.

## Security notes

- Every Server Action input is validated with Zod (`lib/validation/schemas.ts`)
  — never trust client input.
- `lib/db/supabase-admin.ts` (service-role, bypasses RLS) is marked
  `server-only` so it cannot be imported into client code.
- No AI or database secret is ever read outside a server context; see
  `.env.local.example`.
- No arbitrary code execution happens anywhere in this prompt — that's
  explicitly deferred to Prompt 3's sandboxed runner.

## Local setup

```bash
npm install
cp .env.local.example .env.local   # fill in a real Supabase project's values
npm run dev
```

Without a real Supabase project, the app still builds and runs — auth
pages render and submit, but calls to Supabase fail gracefully (e.g. the
home dashboard falls back to an empty/onboarding state instead of
crashing).

## Environment variables

See `.env.local.example`. Required: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_SITE_URL`. AI provider keys are commented out until Prompt 5.

## Development commands

```bash
npm run dev         # start the dev server (Turbopack)
npm run build        # production build
npm run lint          # ESLint
npm run typecheck    # tsc --noEmit
npm run test           # Vitest
```

## The 10-prompt roadmap

1. **Foundation** (this prompt) — architecture, database, auth, learning
   engine foundations, design system foundations.
2. Curriculum + original problem bank + lessons + learning paths.
3. Secure multi-language code execution + test-case evaluator.
4. Adaptive learning: Skill Graph UI + Mastery Engine + Mistake DNA +
   spaced repetition.
5. AI Code Mentor: hints, code review, explanation engine.
6. Progressive projects + requirements + project evaluator.
7. GitHub integration + deployment + project verification + developer
   portfolio.
8. AI interview simulator + debugging mode + Reality Mode + system-design
   challenges.
9. Premium UI/UX + GSAP/Motion + gamification + immersive learning
   experience.
10. Full security audit + testing + performance + accessibility +
    deployment + product-wide QA + final launch audit.
