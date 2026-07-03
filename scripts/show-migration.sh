#!/usr/bin/env bash
# =============================================================================
#  GCI show-migration — Supabase SQL Editor 用の migration SQL を表示
#
#  このプロジェクトはローカルから prisma migrate deploy が使えないため
#  (DIRECT_URL 制限)、migration は Supabase SQL Editor で手動実行する運用。
#  このスクリプトはコピペ用の SQL をそのまま出力します。
#
#  Usage:
#    ./scripts/show-migration.sh              # 一覧を表示
#    ./scripts/show-migration.sh latest       # 最新の migration SQL を表示
#    ./scripts/show-migration.sh <部分名>      # 名前に一致する migration を表示
#      例: ./scripts/show-migration.sh beta_feedback
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIG_DIR="$ROOT/packages/db/prisma/migrations"

if [ ! -d "$MIG_DIR" ]; then
  echo "❌ migrations ディレクトリが見つかりません: $MIG_DIR"
  exit 1
fi

list_migrations() {
  ls -1 "$MIG_DIR" | grep -E '^[0-9]{8,}' | sort
}

show_sql() {
  local name="$1"
  local file="$MIG_DIR/$name/migration.sql"
  if [ ! -f "$file" ]; then
    echo "❌ migration.sql が見つかりません: $name"
    exit 1
  fi
  echo "═══════════════════════════════════════════════════════"
  echo "  Migration: $name"
  echo "  ↓↓↓ ここから下を Supabase SQL Editor に貼り付けて実行 ↓↓↓"
  echo "═══════════════════════════════════════════════════════"
  echo ""
  cat "$file"
  echo ""
  echo "═══════════════════════════════════════════════════════"
  echo "  実行後チェックリスト:"
  echo "  1. 'Success. No rows returned' 等の成功表示を確認"
  echo "  2. スキーマ変更があれば: cd packages/db && npx prisma generate"
  echo "  3. 型チェック: cd apps/web && npx tsc --noEmit"
  echo "═══════════════════════════════════════════════════════"
}

case "${1:-list}" in
  list)
    echo "── Migrations（古い順） ──"
    list_migrations | sed 's/^/  /'
    echo ""
    echo "SQL を表示するには: ./scripts/show-migration.sh latest または <部分名>"
    ;;
  latest)
    latest=$(list_migrations | tail -1)
    show_sql "$latest"
    ;;
  *)
    match=$(list_migrations | grep -i "$1" | tail -1) || true
    if [ -z "${match:-}" ]; then
      echo "❌ 「$1」に一致する migration がありません。一覧:"
      list_migrations | sed 's/^/  /'
      exit 1
    fi
    show_sql "$match"
    ;;
esac
