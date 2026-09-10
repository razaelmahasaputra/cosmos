#!/usr/bin/env bash
# Preview the Next.js dev server on https://preview.razael-fox.my.id
# via the existing Cloudflare "preview" tunnel (uses `cloudflared login` cert).
#
# Usage:
#   pnpm dev:preview          # Next dev on :3000 + tunnel connector
#   PORT=3001 pnpm dev:preview
#
# One-time setup (already done, safe to re-run):
#   pnpm preview:dns
set -euo pipefail

DOMAIN="preview.razael-fox.my.id"
TUNNEL_NAME="cosmos-preview"
PORT="${PORT:-3000}"

cleanup() {
  # shellcheck disable=SC2086
  kill ${NEXT_PID:-} ${CF_PID:-} 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Idempotent: ensures the CNAME preview.razael-fox.my.id -> <tunnel>.cfargotunnel.com
if ! cloudflared tunnel route dns "$TUNNEL_NAME" "$DOMAIN" 2>&1 | tee /dev/stderr | grep -qiE "added|success"; then
  echo "(DNS record probably already exists, continuing...)"
fi

pnpm next dev --port "$PORT" --hostname 127.0.0.1 &
NEXT_PID=$!

echo "Waiting for Next.js on http://127.0.0.1:${PORT} ..."
for _ in $(seq 1 90); do
  if curl -sf "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
curl -sf "http://127.0.0.1:${PORT}/" >/dev/null || {
  echo "ERROR: Next.js did not become ready on :${PORT}" >&2
  exit 1
}

# Token passed via env (not argv) so it doesn't leak into `ps` output.
# Retry loop: the Cloudflare API occasionally times out on the first attempt.
export TUNNEL_TOKEN
TUNNEL_TOKEN=""
for _ in $(seq 1 6); do
  FETCHED="$(cloudflared tunnel token "$TUNNEL_NAME" 2>/dev/null || true)"
  if [ -n "$FETCHED" ]; then
    TUNNEL_TOKEN="$FETCHED"
    break
  fi
  echo "Tunnel token fetch failed, retrying in 5s ..." >&2
  sleep 5
done
if [ -z "$TUNNEL_TOKEN" ]; then
  echo "ERROR: could not fetch tunnel token for '${TUNNEL_NAME}' after 6 attempts." >&2
  exit 1
fi

cloudflared tunnel run --url "http://127.0.0.1:${PORT}" &
CF_PID=$!

echo ""
echo "Preview live at https://${DOMAIN}  (tunnel '${TUNNEL_NAME}' -> 127.0.0.1:${PORT})"
echo "Press Ctrl+C to stop (both Next.js and cloudflared shut down)."
echo ""
wait
