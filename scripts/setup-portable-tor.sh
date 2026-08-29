#!/usr/bin/env bash
# One-shot: sync stack + static files to the homelab portable and start Tor mirror.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${PORTABLE_HOST:-david@homelab-portable}"
DIR="${PORTABLE_DIR:-~/davidcoen-tor}"

echo "=== sync compose + html to ${HOST}:${DIR} ==="
python3 "$ROOT/scripts/deploy.py" --portable-only --stack

echo "=== docker compose up ==="
ssh "$HOST" "cd ${DIR} && docker compose up -d --build"

echo "=== wait for onion hostname ==="
for i in $(seq 1 30); do
  ONION=$(ssh "$HOST" "cd ${DIR} && docker compose exec -T tor cat /var/lib/tor/davidcoen/hostname 2>/dev/null" | tr -d '\r' | head -1 || true)
  if [[ -n "${ONION}" && "${ONION}" == *.onion ]]; then
    echo "${ONION}" > "$ROOT/deploy/onion-hostname"
    echo "Onion: http://${ONION}/"
    echo "Saved deploy/onion-hostname"
    exit 0
  fi
  sleep 2
done

echo "Tor hostname not ready yet — check: ssh ${HOST} 'cd ${DIR} && docker compose logs tor'" >&2
exit 1
