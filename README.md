# SmoothOS Estimate — Smooth Construction Services

Complete internal revenue system: formula-driven estimating, branded proposals, live dashboards, CRM webhooks, and job tracking.

**Company:** Smooth Construction Services · Boston, MA

## Quick Start

```bash
cp .env.example .env
# Set AUTH_SECRET to a long random string
npm install
npm run db:setup
npm run dev          # http://localhost:3000
```

**Login:** `estimator@smoothconstruction.com` / `smooth2025!` (also admin, manager)

## System Status

| Phase | Status |
|-------|--------|
| Phase 1 — Core Revenue Engine | ✅ Complete |
| Phase 2 — Dashboard + Analytics + CRM | ✅ Complete |
| Phase 3 — Automation + Jobs + Batch | ✅ Complete |
| E2E golden path | ✅ Passing (`npm run e2e`) |
| Unit tests | ✅ 12 pricing engine tests |

## Production Deploy

```bash
# PostgreSQL required
cp .env.example .env   # set AUTH_SECRET, DATABASE_URL
npm install && npm run db:setup && npm run build && npm run start:prod
# Or: docker compose up --build
```

**Live locally:** http://localhost:3000

## Features

### Pricing & Estimating
- Formula engine for 10 services (no AI pricing)
- Margin guardrails (green/yellow/red)
- Manager approval workflow
- Multifamily batch estimator (`/estimates/batch`)

### Proposals
- Branded PDF generation
- AI scope writing (Anthropic API when `ANTHROPIC_API_KEY` set; rules fallback otherwise)
- Email send via Resend (`RESEND_API_KEY`)
- Client e-sign portal (`/proposals/view/{token}`)
- Approve / decline with job creation

### Dashboard & Alerts
- Executive KPIs, pipeline funnel, revenue trend
- Service performance, marketing sources, estimator metrics
- Live alerts: stale leads, low margin, high value, follow-up overdue
- Cron: `POST /api/cron/alerts` with `x-cron-secret` header

### CRM Integration
- Webhook dispatcher for HubSpot, GoHighLevel, Zoho, Airtable, SmoothOS native
- Configure at `/admin/crm` or via env webhook URLs
- Events: lead.created, estimate.summary, proposal.sent, proposal.approved, job.created

### Admin
- Editable product rate table (`/admin/rates`)
- Marketing ad spend + CPL (`/admin/ad-spend`)
- CRM integration config (`/admin/crm`)

### Auth & RBAC
- JWT session cookies
- Roles: admin, manager, estimator, sales, office
- Middleware protects all internal routes

## Documentation

| Document | Path |
|----------|------|
| System design | `docs/smoothos/01-system-design.md` |
| Database schema | `docs/smoothos/02-database-schema.md` |
| Estimator formulas | `docs/smoothos/03-estimator-formulas.md` |
| UI specification | `docs/smoothos/04-ui-specification.md` |
| API contract | `docs/smoothos/05-api-contract.md` |

## Environment Variables

See `.env.example` for full list. Required:
- `DATABASE_URL`
- `AUTH_SECRET`

Optional:
- `ANTHROPIC_API_KEY` — AI proposal scope
- `RESEND_API_KEY` — proposal email
- `HUBSPOT_WEBHOOK_URL` / `CRM_WEBHOOK_URL` — CRM sync
- `CRON_SECRET` — alerts cron endpoint

## Cron (Alerts)

```bash
curl -X POST http://localhost:3000/api/cron/alerts \
  -H "x-cron-secret: your-cron-secret"
```

Schedule every 15 minutes in production.
