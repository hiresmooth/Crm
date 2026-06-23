# SmoothOS Estimate — Smooth Construction Services

Implementation-ready system for formula-driven estimating, branded proposal generation, and live revenue dashboards.

**Company:** Smooth Construction Services · Boston, MA  
**Services:** Spray foam, attic/basement/crawl insulation, blow-in, air sealing, weatherization, drywall, plastering, window replacement

**Status:** Phase 1 (Core Revenue Engine) implemented — see [What's Built](#whats-built-phase-1) below.

## Quick Start

```bash
# Prerequisites: Node 20+, PostgreSQL 16+
cp .env.example .env
npm install
npm run db:setup    # prisma db push + seed
npm run dev         # http://localhost:3000
```

**Seed logins** (for future auth): `admin@smoothconstruction.com` / `smooth2025!`

**Sample lead:** `L-2025-00001` — Maria Santos, Somerville attic insulation

## What's Built (Phase 1)

| Module | Status |
|--------|--------|
| Formula pricing engine (10 services) | ✅ `src/lib/pricing-engine/` |
| Unit tests (pricing engine) | ✅ `npm test` |
| PostgreSQL schema + Prisma | ✅ `prisma/schema.prisma` |
| Rate table seed data | ✅ `prisma/seed.ts` |
| Lead intake API + UI | ✅ |
| Estimate create/calculate/submit/approve | ✅ |
| Margin guardrails (green/yellow/red) | ✅ |
| Proposal generation + scope writer | ✅ |
| Branded PDF proposals | ✅ `@react-pdf/renderer` |
| Client proposal view + approve | ✅ |
| Basic executive dashboard | ✅ |
| Rate tables admin (read-only) | ✅ |

## Documentation

| Document | Description |
|----------|-------------|
| [01-system-design.md](docs/smoothos/01-system-design.md) | Full system overview (sections 1–14) |
| [02-database-schema.md](docs/smoothos/02-database-schema.md) | PostgreSQL schema, enums, indexes |
| [03-estimator-formulas.md](docs/smoothos/03-estimator-formulas.md) | Per-service calculation logic |
| [04-ui-specification.md](docs/smoothos/04-ui-specification.md) | Estimator, proposal, dashboard, lead detail UI |
| [05-api-contract.md](docs/smoothos/05-api-contract.md) | REST API v1 contract |

## Database

Prisma schema: `prisma/schema.prisma`

```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/smoothos"
npm run db:setup
```

## Architecture

- **Pricing:** Formula engine + editable rate tables (no AI pricing)
- **Proposals:** PDF generation from approved estimates; AI for scope language only
- **Dashboard:** Live KPIs from lead → estimate → proposal → job funnel
- **CRM:** Webhook adapters for HubSpot, GoHighLevel, Zoho, Airtable, SmoothOS native

## Workflow

```
Lead → Estimate (formula calc) → Submit → Manager Approve
  → Proposal (scope from lines) → PDF → Internal Approve → Send
  → Client views/approves → Job created
```

## API Endpoints

- `POST /api/v1/leads` — lead intake
- `POST /api/v1/estimates` — create + calculate
- `POST /api/v1/estimates/:id/submit` — submit for review
- `POST /api/v1/estimates/:id/approve` — manager approve
- `POST /api/v1/proposals` — generate proposal
- `POST /api/v1/proposals/:id/generate-pdf` — branded PDF
- `POST /api/v1/proposals/:id/send` — send to client
- `GET /api/v1/dashboard/executive` — KPIs

## Implementation Phases

1. **Phase 1** — Core revenue engine (estimator, formulas, approval, basic PDF) — **done**
2. **Phase 2** — Dashboard analytics, alerts, CRM webhooks, controlled AI scope, auth/RBAC
3. **Phase 3** — Advanced automation, e-sign, multifamily batch, jobs handoff

## Docker (optional)

```bash
docker compose up -d   # PostgreSQL on :5432
```
