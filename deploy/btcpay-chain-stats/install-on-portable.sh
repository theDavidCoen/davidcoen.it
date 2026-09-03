#!/bin/bash
# Install/refresh chain-stats on homelab-portable. Run from anywhere:
#   ./deploy/btcpay-chain-stats/install-on-portable.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
HOST="${PORTABLE_HOST:-homelab-portable}"

ssh "$HOST" "mkdir -p ~/apps/btcpay-chain-stats ~/.config/systemd/user"
rsync -a --delete \
  --exclude 'install-on-portable.sh' \
  --exclude '__pycache__/' \
  "$ROOT/" "$HOST:apps/btcpay-chain-stats/"

ssh "$HOST" bash -s <<'REMOTE'
set -euo pipefail
chmod 755 ~/apps/btcpay-chain-stats/chain_stats.py
cp ~/apps/btcpay-chain-stats/btcpay-chain-stats.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now btcpay-chain-stats.service
systemctl --user restart btcpay-chain-stats.service
docker cp ~/apps/btcpay-chain-stats/nginx-vhost.inc nginx:/etc/nginx/vhost.d/btcpay.davidcoen.it
docker kill -s HUP nginx-gen >/dev/null
sleep 2
docker exec nginx nginx -t
docker exec nginx nginx -s reload
systemctl --user --no-pager --full status btcpay-chain-stats.service | head -20
REMOTE

echo "Installed. Probe: https://btcpay.davidcoen.it/api/public/chain-stats"
