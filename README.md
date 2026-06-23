# SmoothOS Estimate — Smooth Construction Services

Implementation-ready **Phase 1: Core Revenue Engine** for formula-driven estimating, branded proposal generation, and operational dashboards.

**Company:** Smooth Construction Services · Boston, MA

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
| [01-system-design.md](docs/smoothos/01-system-design.md) | Full system overview |
| [02-database-schema.md](docs/smoothos/02-database-schema.md) | PostgreSQL schema |
| [03-estimator-formulas.md](docs/smoothos/03-estimator-formulas.md) | Per-service formulas |
| [04-ui-specification.md](docs/smoothos/04-ui-specification.md) | UI wire spec |
| [05-api-contract.md](docs/smoothos/05-api-contract.md) | REST API v1 |

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

## Phase 2 (Next)

- Full analytics dashboards (service, source, estimator)
- Alerts engine
- CRM webhooks (HubSpot)
- Controlled AI scope writing (Claude API)
- Auth + role-based access

## Docker (optional)

```bash
docker compose up -d   # PostgreSQL on :5432
```
