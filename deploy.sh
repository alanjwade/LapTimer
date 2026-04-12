#!/usr/bin/env bash
set -euo pipefail

REMOTE_USER="homelab"
REMOTE_HOST="homelab00"
REMOTE_PATH="/home/homelab/homelab00-config/websites/volumes/sites/lap_timer"

echo "==> Syncing files to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}"
rsync -az --delete \
  --exclude='.git' \
  --exclude='*.sh' \
  ./ "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/"

echo "==> Building and starting container on remote"
ssh "${REMOTE_USER}@${REMOTE_HOST}" \
  "cd '${REMOTE_PATH}' && docker compose up --build -d"

echo "==> Done"
