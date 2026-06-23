# SmoothOS Estimate — Smooth Construction Services

Implementation-ready system design for formula-driven estimating, branded proposal generation, and live revenue dashboards.

**Company:** Smooth Construction Services · Boston, MA  
**Services:** Spray foam, attic/basement/crawl insulation, blow-in, air sealing, weatherization, drywall, plastering, window replacement

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
npx prisma migrate dev
```

## Architecture

- **Pricing:** Formula engine + editable rate tables (no AI pricing)
- **Proposals:** PDF generation from approved estimates; AI for scope language only
- **Dashboard:** Live KPIs from lead → estimate → proposal → job funnel
- **CRM:** Webhook adapters for HubSpot, GoHighLevel, Zoho, Airtable, SmoothOS native

## Implementation Phases

1. **Phase 1** — Core revenue engine (estimator, formulas, approval, basic PDF)
2. **Phase 2** — Dashboard, analytics, CRM webhooks, client proposal portal
3. **Phase 3** — Advanced automation, e-sign, multifamily batch, jobs handoff
