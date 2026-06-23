#!/usr/bin/env bash
# Local production deploy — run from repo root
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.example .env
  AUTH=$(openssl rand -hex 32)
  CRON=$(openssl rand -hex 16)
  sed -i "s|AUTH_SECRET=.*|AUTH_SECRET=\"$AUTH\"|" .env
  sed -i "s|CRON_SECRET=.*|CRON_SECRET=\"$CRON\"|" .env
  echo "Created .env with generated secrets"
fi

# shellcheck disable=SC1091
source .env 2>/dev/null || true

echo "==> Installing dependencies"
npm ci

echo "==> Setting up database"
npm run db:setup

echo "==> Building production app"
npm run build

echo "==> Starting production server on port 3000"
echo "    Login: estimator@smoothconstruction.com / smooth2025!"
npm run start:prod
