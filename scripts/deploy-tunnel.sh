#!/usr/bin/env bash
# Expose local SmoothOS instance via Cloudflare quick tunnel (for testing)
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-3000}"
CLOUDFLARED="${CLOUDFLARED:-/tmp/cloudflared}"

if [ ! -x "$CLOUDFLARED" ]; then
  echo "Downloading cloudflared..."
  curl -sL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o "$CLOUDFLARED"
  chmod +x "$CLOUDFLARED"
fi

# Ensure app is running
if ! curl -sf "http://localhost:$PORT/api/health" > /dev/null 2>&1; then
  echo "Starting production server on port $PORT..."
  npm run start:prod &
  for i in $(seq 1 30); do
    curl -sf "http://localhost:$PORT/api/health" > /dev/null && break
    sleep 1
  done
fi

LOG="/tmp/smoothos-tunnel.log"
rm -f "$LOG"
"$CLOUDFLARED" tunnel --url "http://localhost:$PORT" 2>&1 | tee "$LOG" &
TUNNEL_PID=$!

for i in $(seq 1 30); do
  URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG" | head -1)
  [ -n "$URL" ] && break
  sleep 1
done

if [ -z "${URL:-}" ]; then
  echo "❌ Failed to get tunnel URL"
  kill $TUNNEL_PID 2>/dev/null || true
  exit 1
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "  SmoothOS is live for testing:"
echo "  $URL"
echo ""
echo "  Login: estimator@smoothconstruction.com / smooth2025!"
echo "  Manager: manager@smoothconstruction.com / smooth2025!"
echo ""
echo "  Tunnel PID: $TUNNEL_PID (stops when session ends)"
echo "════════════════════════════════════════════════════════"
