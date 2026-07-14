# CampusCore

An AI-cored University Management System, generically built and inspired by
the structure of a modern Ghanaian public university (schools, departments,
programmes, WASSCE-based admissions, CWA grading). Fully rebrandable — no
institution branding is hard-coded.

Stack: Next.js 15 (App Router, Server Actions), TypeScript, PostgreSQL +
Prisma, better-auth, Tailwind CSS, and the Anthropic Claude API as the AI
core (with a mock provider for offline development).

## Portals

Four route groups, gated by role via `src/lib/rbac.ts`:

- `/apply` — prospective applicants
- `/student` — enrolled students and alumni
- `/staff` — lecturers, HoDs, deans, and all administrative officers
- `/admin` — system admin, management, registrar (institution-wide config)

18 role codes exist (`ROLES` in `src/lib/rbac.ts`) so responsibilities can
later be split across real staff accounts. For now, `npm run db:seed`
creates one **super user** holding all 18 roles, for exercising every
workflow end-to-end without juggling multiple logins.

## AI features (Claude API)

Every module ships an AI feature, always with a human approving the final
outcome: applicant chatbot + WASSCE document extraction + admissions
pre-screening (Phase 1), grading assistance (Phase 4), quiz generation
(Phase 7), announcement drafting (Phase 8), and a natural-language analytics
assistant using bounded tool-use over safe read-only queries (Phase 10).
Every call is logged to `AIAuditLog`. Set `AI_PROVIDER=mock` (no API key
needed) to develop without Claude API spend, or `AI_PROVIDER=anthropic`
with `ANTHROPIC_API_KEY` set for real responses; `auto` (default) uses
Anthropic when a key is present and falls back to mock otherwise.

## Local development

```bash
docker compose up -d db          # PostgreSQL on localhost:5433
cp .env.example .env              # fill in DATABASE_URL, BETTER_AUTH_SECRET, etc.
npm install
npm run db:migrate
npm run db:seed
npm run dev                       # http://localhost:3000
```

Seeded super user: `super@demo.campuscore.test` / `Password123!`.

## Production (Docker)

```bash
docker compose up -d db
docker compose --profile prod up -d --build app
```

The `app` service builds the multi-stage `Dockerfile` (Next.js
`output: "standalone"`) and runs against the same `db` service. Configure
via environment variables read by `docker-compose.yml`: `BETTER_AUTH_SECRET`,
`BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `ANTHROPIC_API_KEY`, `AI_PROVIDER`,
and `APP_PORT` (host port, default 3000). Run `npm run db:migrate` and
`npm run db:seed` against the `db` service before first use.

## Scripts

- `npm run dev` / `build` / `start` — Next.js
- `npm run typecheck` — `tsc --noEmit`
- `npm run db:migrate` / `db:seed` / `db:studio` — Prisma
- `npm run docs:plan` — regenerate `docs/University-Management-System-Plan.docx`
