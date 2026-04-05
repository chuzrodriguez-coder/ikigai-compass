#!/bin/sh
# deploy-build.sh
# Runs the mandatory GitHub sync gate, then the API server production build.
# Used as the production build command for the api-server artifact so that
# every deployment begins with a GitHub check-in. Exits non-zero on any failure.
set -e

echo "[deploy] Starting mandatory GitHub sync..."
node scripts/pre-deploy-github-sync.mjs

echo "[deploy] GitHub sync complete. Building API server..."
pnpm --filter @workspace/api-server run build

echo "[deploy] Build complete."
