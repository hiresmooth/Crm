# SmoothOS Deployment Guide

## Option A — Render (recommended, permanent, free tier)

No server knowledge needed. Render hosts the app + database for you.

1. Open **https://dashboard.render.com/blueprints**
2. Click **New Blueprint Instance**
3. Connect GitHub and select repo **`hiresmooth/Crm`**
4. Render reads `render.yaml` and creates:
   - PostgreSQL database (`smoothos-db`)
   - Web service (`smoothos-estimate`)
5. After deploy finishes (~5 min), open the service URL Render gives you
6. In Render dashboard → **smoothos-estimate** → **Environment**, set:
   - `NEXT_PUBLIC_APP_URL` = your Render URL (e.g. `https://smoothos-estimate.onrender.com`)
7. Click **Manual Deploy** once after setting that variable

**Login:** `estimator@smoothconstruction.com` / `smooth2025!`  
Change passwords immediately under **Admin → Users**.

### Alerts cron on Render
Add a **Cron Job** in Render:
- Schedule: `*/15 * * * *`
- Command: `curl -sf -X POST $RENDER_EXTERNAL_URL/api/cron/alerts -H "x-cron-secret: $CRON_SECRET"`

---

## Option B — Local / VPS production

```bash
cp .env.example .env          # edit AUTH_SECRET, DATABASE_URL
bash scripts/deploy-production.sh
```

Requires PostgreSQL running locally or remotely.

---

## Option C — Docker

```bash
export AUTH_SECRET=$(openssl rand -hex 32)
docker compose up --build -d
```

Open http://localhost:3000

---

## Verify deployment

```bash
E2E_BASE_URL=https://your-app-url npm run e2e
```

Should print: `✅ E2E golden path PASSED`

---

## Optional environment variables

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Send proposal emails to clients |
| `ANTHROPIC_API_KEY` | AI-generated proposal scope text |
| `HUBSPOT_WEBHOOK_URL` | CRM sync on lead/proposal events |
| `CRON_SECRET` | Secures `/api/cron/alerts` endpoint |
