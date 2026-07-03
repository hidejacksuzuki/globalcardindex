#!/usr/bin/env bash
# =============================================================================
#  GCI dev-restart — ポート解放 + env診断 + 起動案内
#
#  「EADDRINUSE: address already in use」が出たらこれを実行。
#  ポート 3000 / 3001 を掴んでいるプロセスだけを終了します
#  （他のアプリには影響しません）。
#
#  Usage:
#    ./scripts/dev-restart.sh          # ポート解放 + env診断 + 起動コマンド案内
#    ./scripts/dev-restart.sh --kill-only   # ポート解放のみ
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "── ポート解放 ──────────────────────────────"
for port in 3000 3001; do
  pids=$(lsof -ti:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -9 2>/dev/null || true
    echo "  ✅ port $port を解放しました (PID: $(echo $pids | tr '\n' ' '))"
  else
    echo "  ✅ port $port は空いています"
  fi
done

if [ "${1:-}" = "--kill-only" ]; then
  exit 0
fi

echo ""
echo "── env 診断 ────────────────────────────────"
if ! "$ROOT/scripts/env-doctor.sh" > /tmp/gci-env-doctor.log 2>&1; then
  echo "  ❌ env に問題があります。詳細:"
  echo ""
  cat /tmp/gci-env-doctor.log
  echo ""
  echo "  env を直してから、もう一度このスクリプトを実行してください。"
  exit 1
fi
echo "  ✅ env は健康です"

echo ""
echo "── 次のコマンドで起動してください ──────────"
echo ""
echo "  ターミナル1:  cd \"$ROOT\" && pnpm dev:web"
echo "  ターミナル2:  cd \"$ROOT\" && pnpm dev:data"
echo ""
echo "  両方 Ready になったら動作確認:"
echo "  ./scripts/smoke-test.sh local"
