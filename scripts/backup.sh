#!/usr/bin/env bash
# scripts/backup.sh
#
# GCI PostgreSQL full backup — pg_dump wrapper
#
# Usage:
#   ./scripts/backup.sh                        # dump to ./backups/
#   BACKUP_DIR=/mnt/nas ./scripts/backup.sh    # custom output directory
#   DRY_RUN=1 ./scripts/backup.sh              # print command, don't run
#
# Required env:
#   DATABASE_URL   — postgresql://user:pass@host:port/dbname
#
# Optional env:
#   BACKUP_DIR     — destination directory (default: ./backups)
#   RETAIN_DAYS    — delete dumps older than N days (default: 14)
#   DRY_RUN        — set to "1" to print the pg_dump command and exit
#
# Output file:
#   $BACKUP_DIR/gci_YYYY-MM-DD_HH-MM-SS.dump  (custom pg_dump format, ~5–10x smaller)
#
# Restore:
#   pg_restore --clean --if-exists -d "$DATABASE_URL" gci_YYYY-MM-DD_HH-MM-SS.dump
#
# Dependencies:
#   pg_dump >= 14 (same major version as the server is strongly recommended)

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-$(dirname "$0")/../backups}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"
TIMESTAMP=$(date -u +"%Y-%m-%d_%H-%M-%S")
FILENAME="gci_${TIMESTAMP}.dump"

# ── Validate DATABASE_URL ─────────────────────────────────────────────────────
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[backup] ERROR: DATABASE_URL is not set." >&2
  exit 1
fi

# ── Dry run ───────────────────────────────────────────────────────────────────
if [[ "${DRY_RUN:-0}" == "1" ]]; then
  echo "[backup] DRY RUN — would execute:"
  echo "  mkdir -p \"${BACKUP_DIR}\""
  echo "  pg_dump --format=custom --no-acl --no-owner --file=\"${BACKUP_DIR}/${FILENAME}\" \"\$DATABASE_URL\""
  echo "[backup] Retention: delete dumps older than ${RETAIN_DAYS} days in ${BACKUP_DIR}"
  exit 0
fi

# ── Check pg_dump ─────────────────────────────────────────────────────────────
if ! command -v pg_dump &>/dev/null; then
  echo "[backup] ERROR: pg_dump not found. Install postgresql-client." >&2
  exit 1
fi

# ── Create output directory ───────────────────────────────────────────────────
mkdir -p "${BACKUP_DIR}"

# ── Run pg_dump ───────────────────────────────────────────────────────────────
echo "[backup] Starting backup → ${BACKUP_DIR}/${FILENAME}"
START_TS=$(date +%s)

pg_dump \
  --format=custom \
  --no-acl \
  --no-owner \
  --verbose \
  --file="${BACKUP_DIR}/${FILENAME}" \
  "${DATABASE_URL}"

END_TS=$(date +%s)
SIZE=$(du -sh "${BACKUP_DIR}/${FILENAME}" | cut -f1)
echo "[backup] Done in $((END_TS - START_TS))s — ${SIZE} — ${BACKUP_DIR}/${FILENAME}"

# ── Retention cleanup ─────────────────────────────────────────────────────────
if [[ "${RETAIN_DAYS}" -gt 0 ]]; then
  DELETED=$(find "${BACKUP_DIR}" -name "gci_*.dump" -mtime "+${RETAIN_DAYS}" -print -delete | wc -l | tr -d ' ')
  if [[ "${DELETED}" -gt 0 ]]; then
    echo "[backup] Retention: deleted ${DELETED} dump(s) older than ${RETAIN_DAYS} days"
  fi
fi

echo "[backup] All done."
