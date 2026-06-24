#!/usr/bin/env bash
# Verify a deployed SmoothOS instance (health + E2E golden path)
set -euo pipefail

BASE_URL="${1:-${E2E_BASE_URL:-http://localhost:3000}}"

echo "==> Health check: $BASE_URL/api/health"
HEALTH=$(curl -sf "$BASE_URL/api/health")
echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"

if ! echo "$HEALTH" | grep -q '"status":"healthy"'; then
  echo "❌ Health check failed"
  exit 1
fi

echo "==> E2E golden path: $BASE_URL"
E2E_BASE_URL="$BASE_URL" npm run e2e

echo "✅ Deployment verified at $BASE_URL"
