#!/usr/bin/env bash
# =============================================================================
#  GCI env doctor — .env.local の健康診断
#
#  秘密の値は一切表示しません（存在・文字数・構造のみ検査）。
#
#  Usage:
#    ./scripts/env-doctor.sh
#
#  検査内容:
#    - apps/web/.env.local / apps/data/.env.local の存在
#    - 必須キーの存在と非空
#    - DATABASE_URL / DIRECT_URL の構造
#        * プレースホルダ [YOUR-PASSWORD] が残っていないか
#        * プロジェクト参照 (postgres.<ref>) が欠けていないか
#        * パスワードに未エンコードの記号がないか
#        * ポート (6543 / 5432) と pgbouncer=true の有無
#        * pooler.supabase.com 経由か (IPv4 環境で db.*.supabase.co 直結は不可)
#
#  Exit code: 0 = 問題なし / 1 = 要修正あり
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ERRORS=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
RESET='\033[0m'

ok()   { echo -e "  ${GREEN}✅${RESET} $1"; }
ng()   { echo -e "  ${RED}❌${RESET} $1"; ERRORS=$((ERRORS+1)); }
warn() { echo -e "  ${YELLOW}⚠️ ${RESET} $1"; }

# ── .env.local から key の値を取り出す（引用符を剥がす） ─────────────
get_val() {
  local file="$1" key="$2"
  local line
  line=$(grep -E "^${key}=" "$file" 2>/dev/null | head -1) || true
  [ -z "$line" ] && return 1
  local val="${line#*=}"
  val="${val%\"}"
  val="${val#\"}"
  printf '%s' "$val"
}

# ── 接続文字列の構造検査（値は表示しない） ──────────────────────────
check_db_url() {
  local key="$1" val="$2" expect_port="$3" expect_pgbouncer="$4"
  local bad=0

  if [[ "$val" == *"YOUR_PASSWORD"* || "$val" == *"YOUR-PASSWORD"* ]]; then
    ng "$key: プレースホルダ [YOUR-PASSWORD] のまま。実際のDBパスワードに置換してください"
    bad=1
  fi
  if [[ "$val" != postgresql://* && "$val" != postgres://* ]]; then
    ng "$key: postgresql:// で始まっていません"
    bad=1
  fi
  if [[ "$val" != *"@"* ]]; then
    ng "$key: @ がなく形式が不正です"
    return
  fi

  local rest="${val#*://}"
  local userinfo="${rest%%@*}"
  local hostpart="${rest#*@}"

  if [[ "$userinfo" != *":"* ]]; then
    ng "$key: 「ユーザー名:パスワード」の区切り : がありません（プロジェクト参照が消えている可能性大）"
    ng "$key: 正しい形式 → postgresql://postgres.<プロジェクト参照>:<パスワード>@..."
    bad=1
  else
    local user="${userinfo%%:*}"
    local pw="${userinfo#*:}"

    if [[ "$user" != postgres.?* ]]; then
      ng "$key: ユーザー名が postgres.<プロジェクト参照> の形式ではありません (現在: ${user})"
      bad=1
    fi
    if [ -z "$pw" ]; then
      ng "$key: パスワード部分が空です"
      bad=1
    elif printf '%s' "$pw" | LC_ALL=C grep -qE '[^A-Za-z0-9%._~-]'; then
      ng "$key: パスワードに未エンコードの記号が含まれています。URLエンコード（%XX形式）が必要です"
      echo "     → python3 -c \"import urllib.parse,getpass; print(urllib.parse.quote(getpass.getpass(), safe=''))\""
      bad=1
    fi
  fi

  if [[ "$hostpart" != *":${expect_port}/"* ]]; then
    ng "$key: ポートが ${expect_port} ではありません"
    bad=1
  fi
  if [ "$expect_pgbouncer" = "yes" ] && [[ "$val" != *"pgbouncer=true"* ]]; then
    ng "$key: ?pgbouncer=true がありません（transaction pooler 用に必須）"
    bad=1
  fi
  if [ "$expect_pgbouncer" = "no" ] && [[ "$val" == *"pgbouncer=true"* ]]; then
    warn "$key: pgbouncer=true が付いています（DIRECT_URL には不要）"
  fi
  if [[ "$hostpart" != *"pooler.supabase.com"* ]]; then
    warn "$key: pooler.supabase.com 経由ではありません。db.<ref>.supabase.co:5432 直結は IPv4 環境から接続できません"
  fi

  if [ "$bad" -eq 0 ]; then
    # プロジェクト参照は公開URLに含まれる非秘密情報なので表示してよい
    # （「SQL Editor を開いているプロジェクト」と「アプリの接続先」のズレを検出するため）
    local ref="${userinfo%%:*}"
    ref="${ref#postgres.}"
    ok "$key: 構造OK (接続先プロジェクト: ${ref}, ${#val}文字)"
  fi
}

# ── 1ファイル分の検査 ────────────────────────────────────────────────
#   REQUIRED（DB系）が壊れていると起動不能 → ❌ (exit 1)
#   RECOMMENDED が空でも起動はできる → ⚠️ （ログイン/メール/cron等の機能が動かない）
check_key() {
  local file="$1" key="$2" level="$3"
  local val
  if ! val=$(get_val "$file" "$key"); then
    if [ "$level" = "required" ]; then ng "$key: 未定義"
    else warn "$key: 未定義（この機能を使うローカルテストはできません）"; fi
    return
  fi
  if [ -z "$val" ]; then
    if [ "$level" = "required" ]; then
      ng "$key: 空です（Vercel の Sensitive 変数は env pull で空になります → 手動で設定が必要）"
    else
      warn "$key: 空です（起動は可能。ログイン/メール/cron 等この値を使う機能は動きません）"
    fi
    return
  fi
  case "$key" in
    DATABASE_URL) check_db_url "$key" "$val" 6543 yes ;;
    DIRECT_URL)   check_db_url "$key" "$val" 5432 no  ;;
    NEXT_PUBLIC_BASE_URL)
      if [[ "$val" == http* ]]; then ok "$key: 設定済み (${#val}文字)"
      else warn "$key: http(s):// で始まっていません"; fi ;;
    *) ok "$key: 設定済み (${#val}文字)" ;;
  esac
}

check_file() {
  local file="$1" required="$2" recommended="$3"
  echo ""
  echo "── ${file#$ROOT/} ──────────────────────────────"

  if [ ! -f "$file" ]; then
    ng "ファイルが存在しません。Next.js はアプリディレクトリ内の .env.local しか読みません"
    echo "     → ルートの .env.local をコピー: cp .env.local ${file#$ROOT/}"
    return
  fi

  local key
  for key in $required;    do check_key "$file" "$key" required;    done
  for key in $recommended; do check_key "$file" "$key" recommended; done
}

echo "============================================="
echo "  GCI env doctor — $(date '+%Y-%m-%d %H:%M:%S')"
echo "  ※ 秘密の値は表示しません"
echo "============================================="

check_file "$ROOT/apps/web/.env.local" \
  "DATABASE_URL DIRECT_URL" \
  "AUTH_SECRET AUTH_RESEND_KEY RESEND_API_KEY NEXT_PUBLIC_BASE_URL"

check_file "$ROOT/apps/data/.env.local" \
  "DATABASE_URL DIRECT_URL" \
  "CRON_SECRET ADMIN_USER ADMIN_PASSWORD"

echo ""
echo "============================================="
if [ "$ERRORS" -gt 0 ]; then
  echo -e "${RED}✗ ${ERRORS} 件の要修正があります。上の ❌ を直してから dev server を再起動してください。${RESET}"
  exit 1
else
  echo -e "${GREEN}✓ env は健康です。${RESET}"
  exit 0
fi
