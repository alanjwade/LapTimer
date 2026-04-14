#!/usr/bin/env bash
set -euo pipefail

REMOTE_USER="homelab"
REMOTE_HOST="homelab00"
REMOTE_PATH="/home/homelab/homelab00-config/websites/volumes/sites/lap_timer"
COMPOSE_ROOT="/home/homelab/homelab00-config/websites"

echo "==> Syncing files to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}"
rsync -az --delete \
  --exclude='.git' \
  --exclude='*.sh' \
  ./ "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/"

echo "==> Building and restarting via compose at ${COMPOSE_ROOT}"
ssh "${REMOTE_USER}@${REMOTE_HOST}" \
  "cd '${COMPOSE_ROOT}' && docker compose up --build -d lap_timer"

echo "==> Done"
