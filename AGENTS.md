# SmoothOS Estimate

Single Next.js 14 (App Router) + Prisma + PostgreSQL app for Smooth Construction Services. Source lives in `src/` (UI pages in `src/app`, API routes in `src/app/api/v1`). See `README.md` for product/feature overview and `docs/smoothos/` for design docs.

## Cursor Cloud specific instructions

### Services & how to run them
- **PostgreSQL 16** is installed locally as a system service (not Docker). Start it with `sudo pg_ctlcluster 16 main start` if it is not already running. The dev role/db are `smoothos` / `smoothos` / `smoothos` matching `DATABASE_URL` in `.env.example`.
- **Web app (Next.js)**: `npm run dev` serves on http://localhost:3000. This is the only app service.

### Non-obvious caveats
- `.env` is gitignored and must exist. Copy `.env.example` to `.env`; `AUTH_SECRET` must be at least 32 characters or auth will fail.
- After installing deps you must run `npm run db:setup` (`prisma db push` + seed) before the app or tests work. It is safe to re-run; it re-pushes the schema and re-seeds.
- Seeded logins (all password `smooth2025!`): `estimator@smoothconstruction.com`, `manager@smoothconstruction.com`, `admin@smoothconstruction.com`.
- `npm run lint` is **not configured** — `next lint` launches an interactive ESLint setup prompt and will hang. CI does not run lint either (see `.github/workflows/ci.yml`). Do not rely on it.
- `npm run e2e` (`scripts/e2e.mjs`) is an HTTP golden-path test that requires the dev server (port 3000) **and** Postgres running. It exercises lead → estimate → approval → proposal → job.
- Optional integrations (Anthropic AI scope, Resend email, CRM webhooks) gracefully fall back when their API keys are absent; no keys are needed for core development or testing.

### Standard commands
Defined in `package.json`: `npm run dev`, `npm test` (Vitest), `npm run build`, `npm run db:setup`, `npm run e2e`.
