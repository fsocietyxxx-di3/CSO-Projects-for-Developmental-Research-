#!/usr/bin/env bash
# Weekly Supabase backup (free tier has no automatic backups).
# Usage: ./scripts/db-dump.sh [output-dir]   (default ./backups, keep it OUT of git)
set -euo pipefail

OUT_DIR="${1:-./backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="${OUT_DIR}/cso-registry-${STAMP}.sql"

[[ -f .env ]] && set -a && source .env && set +a

: "${DATABASE_URL:?DATABASE_URL must be set (from .env or environment)}"

mkdir -p "${OUT_DIR}"
npx --yes supabase --help >/dev/null 2>&1 || true

if npx --yes supabase db dump --db-url "${DATABASE_URL}" -f "${OUT_FILE}"; then
  echo "Backup written to ${OUT_FILE}"
else
  echo "supabase CLI dump failed — falling back to pg_dump" >&2
  pg_dump --no-owner --no-privileges "${DATABASE_URL}" > "${OUT_FILE}"
  echo "Backup written to ${OUT_FILE}"
fi
