#!/usr/bin/env bash
# Register alerts cron (run every 15 min). Requires CRON_SECRET in .env
set -euo pipefail
cd "$(dirname "$0")/.."
source .env 2>/dev/null || { echo "Missing .env"; exit 1; }
URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"
CRON_LINE="*/15 * * * * curl -sf -X POST $URL/api/cron/alerts -H \"x-cron-secret: $CRON_SECRET\" > /dev/null"
(crontab -l 2>/dev/null | grep -v "api/cron/alerts"; echo "$CRON_LINE") | crontab -
echo "Alerts cron installed: every 15 minutes -> $URL/api/cron/alerts"
