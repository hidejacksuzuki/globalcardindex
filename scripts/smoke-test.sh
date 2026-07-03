#!/usr/bin/env bash
# =============================================================================
#  GCI スモークテスト（ローカル / 本番 両対応）
#  Usage:
#    ./scripts/smoke-test.sh              # 本番: https://gci-index.com
#    ./scripts/smoke-test.sh local        # ローカル: localhost:3000 / 3001
#    BASE_URL=https://preview-xxx.vercel.app ./scripts/smoke-test.sh
#    CRON_SECRET=xxx ./scripts/smoke-test.sh   # cron dry-run も実行
#
#  Exit code: 0 = 全チェック合格 / 1 = 1件以上 FAIL
# =============================================================================
set -uo pipefail

MODE="${1:-prod}"

if [ "$MODE" = "local" ]; then
  BASE_URL="${BASE_URL:-http://localhost:3000}"
  DATA_URL="${DATA_URL:-http://localhost:3001}"
else
  BASE_URL="${BASE_URL:-https://gci-index.com}"
  DATA_URL="${DATA_URL:-https://www.gci-data.com}"
fi
CRON_SECRET="${CRON_SECRET:-}"

PASS=0
FAIL=0
SKIP=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
RESET='\033[0m'

# NOTE: ((PASS++)) は初回に exit code 1 を返し set -e と併用すると即死するため
#       算術展開で加算する（bash の罠）
pass()  { echo -e "${GREEN}  PASS${RESET}  $1"; PASS=$((PASS+1)); }
fail()  { echo -e "${RED}  FAIL${RESET}  $1"; FAIL=$((FAIL+1)); }
skip()  { echo -e "${YELLOW}  SKIP${RESET}  $1 (env var not set)"; SKIP=$((SKIP+1)); }
section(){ echo ""; echo "── $1 ──────────────────────────────────────────"; }

# ── ヘルパー: HTTP ステータスコードを取得 ──────────────────────────
# NOTE: Next.js dev モードは初回アクセス時にルートをコンパイルするため
#       30秒程度かかることがある（本番/2回目以降はもっと速い）。
http_status() {
  curl -s -o /dev/null -w "%{http_code}" \
    -H "User-Agent: GCI-SmokeTest/1.0" \
    --max-time 30 \
    "$@"
}

# ── ヘルパー: レスポンスボディを取得 ──────────────────────────────
http_body() {
  curl -s --max-time 30 \
    -H "User-Agent: GCI-SmokeTest/1.0" \
    "$@"
}

# ── ヘルパー: JSON フィールドを確認 ───────────────────────────────
# NOTE: "echo "$x" | grep -q pattern" は、pattern が長い出力の先頭付近で
#       マッチすると grep が早期にパイプを閉じ、書き込み側が SIGPIPE を受けて
#       pipefail 下で「マッチしたのに失敗」扱いになることがある（sitemap.xml で実際に発生）。
#       <<< (herestring) はパイプではなく一時FD経由なのでこの問題が起きない。
json_ok() {
  grep -q '"ok":true' <<< "$1"
}

echo "============================================="
echo "  GCI Smoke Test — $(date '+%Y-%m-%d %H:%M:%S JST')"
echo "  BASE: $BASE_URL"
echo "  DATA: $DATA_URL"
echo "============================================="

# ─────────────────────────────────────────────────────────────────
section "Public pages (web app)"
# ─────────────────────────────────────────────────────────────────

check_page() {
  local label="$1"
  local url="$2"
  local expect="${3:-200}"
  local status
  status=$(http_status "$url")
  # dev モードの重いページ (全カード集計等) は初回コンパイル+DBクエリで
  # 30秒を超えることがある → 000 (タイムアウト) のときだけ1回リトライ
  if [ "$status" = "000" ] && [ "$MODE" = "local" ]; then
    status=$(http_status "$url")
  fi
  if [ "$status" = "$expect" ]; then
    pass "$label ($status)"
  else
    fail "$label — expected $expect, got $status ($url)"
  fi
}

check_page "Home / (→ /ja locale redirect)" "$BASE_URL/" "307"
check_page "Card listing /cards"      "$BASE_URL/cards"
check_page "Marketboard"              "$BASE_URL/marketboard"
check_page "Trending"                 "$BASE_URL/trending"
check_page "Gainers"                  "$BASE_URL/gainers"
check_page "Losers"                   "$BASE_URL/losers"
check_page "Daily recap"              "$BASE_URL/daily"
check_page "Games list"               "$BASE_URL/games"
check_page "Most requested"           "$BASE_URL/most-requested"
check_page "Newsletter signup"        "$BASE_URL/newsletter"
check_page "Terms"                    "$BASE_URL/terms"
check_page "About"                    "$BASE_URL/about"
check_page "Beta invite"              "$BASE_URL/beta"
# /login は locale cookie の有無で 200（rewrite）にも 307（redirect）にもなる
login_status=$(http_status "$BASE_URL/login")
case "$login_status" in
  200|307) pass "Login page ($login_status — locale処理により両方正)" ;;
  *)       fail "Login page — expected 200/307, got $login_status" ;;
esac
check_page "Verify page"              "$BASE_URL/login/verify"
check_page "Watchlist"                "$BASE_URL/watchlist"

# 認証ガード付きページ → 302/307 どちらも正
check_redirect() {
  local label="$1"; local url="$2"
  local status
  status=$(http_status "$url")
  case "$status" in
    302|307) pass "$label ($status → login)" ;;
    *)       fail "$label — expected 302/307, got $status ($url)" ;;
  esac
}
check_redirect "Account (auth guard)"   "$BASE_URL/account"
check_redirect "Portfolio (auth guard)" "$BASE_URL/portfolio"

# ─────────────────────────────────────────────────────────────────
section "Beta Feedback API"
# ─────────────────────────────────────────────────────────────────

# GET は 405（POST 専用であること）
status=$(http_status "$BASE_URL/api/v1/feedback")
if [ "$status" = "405" ]; then
  pass "Feedback API — GET rejected (405)"
else
  fail "Feedback API — expected 405 on GET, got $status"
fi

# 空 body の POST は 400（バリデーションが効いていること）
status=$(http_status -X POST -H "Content-Type: application/json" -d '{}' "$BASE_URL/api/v1/feedback")
if [ "$status" = "400" ]; then
  pass "Feedback API — empty POST rejected (400)"
else
  fail "Feedback API — expected 400 on empty POST, got $status"
fi

# ─────────────────────────────────────────────────────────────────
section "Static assets / feeds"
# ─────────────────────────────────────────────────────────────────

# sitemap.xml（全カードslugをDBから引くため出力が数百KBになる）
body=$(http_body "$BASE_URL/sitemap.xml")
if grep -q "<urlset" <<< "$body"; then
  pass "Sitemap — valid XML with <urlset>"
else
  fail "Sitemap — <urlset> not found (received ${#body} bytes)"
fi

# robots.txt
body=$(http_body "$BASE_URL/robots.txt")
if grep -q "Disallow: /admin/" <<< "$body"; then
  pass "robots.txt — /admin/ disallowed"
else
  fail "robots.txt — /admin/ not disallowed"
fi

# RSS feed
body=$(http_body "$BASE_URL/feed.xml")
if grep -q "<rss" <<< "$body"; then
  pass "RSS feed — valid <rss> element"
else
  fail "RSS feed — <rss> not found"
fi

# ─────────────────────────────────────────────────────────────────
section "Health & API endpoints (web app)"
# ─────────────────────────────────────────────────────────────────

body=$(http_body "$BASE_URL/api/v1/health")
if json_ok "$body"; then
  pass "Health endpoint — ok:true"
else
  fail "Health endpoint — unexpected response: $(echo "$body" | head -c 120)"
fi

# Auth.js CSRF endpoint
# NOTE: local dev では AUTH_SECRET が apps/web/.env.local に未設定だと
#       500 "server configuration" になる。これは env-doctor が別途警告するので
#       ここでは local 限定で SKIP 扱いにし、本番では通常通り FAIL 判定する。
status=$(http_status "$BASE_URL/api/auth/csrf")
if [ "$status" = "200" ]; then
  pass "Auth.js CSRF endpoint — 200"
elif [ "$MODE" = "local" ] && [ "$status" = "500" ]; then
  skip "Auth.js CSRF endpoint — AUTH_SECRET が apps/web/.env.local に未設定の可能性 (env-doctor.sh で確認)"
else
  fail "Auth.js CSRF endpoint — $status"
fi

# Auth.js session endpoint (unauthenticated → 200 with null session)
body=$(http_body "$BASE_URL/api/auth/session")
if grep -q "{}" <<< "$body"; then
  pass "Auth.js session (unauth) — returns {}"
elif [ "$MODE" = "local" ] && grep -qi "server configuration" <<< "$body"; then
  skip "Auth.js session endpoint — AUTH_SECRET が apps/web/.env.local に未設定の可能性 (env-doctor.sh で確認)"
else
  # May return {"user":null} depending on Auth.js version
  if [ "$(http_status "$BASE_URL/api/auth/session")" = "200" ]; then
    pass "Auth.js session (unauth) — 200"
  else
    fail "Auth.js session endpoint — unexpected: $(head -c 80 <<< "$body")"
  fi
fi

# ─────────────────────────────────────────────────────────────────
section "noindex enforcement (auth / account pages)"
# ─────────────────────────────────────────────────────────────────

check_noindex() {
  local label="$1"
  local url="$2"
  local headers
  headers=$(curl -s -I --max-time 15 \
    -H "User-Agent: GCI-SmokeTest/1.0" \
    -L "$url" 2>/dev/null)
  # Check for X-Robots-Tag noindex or meta noindex in body
  local body
  body=$(http_body "$url")
  if grep -qi "x-robots-tag.*noindex" <<< "$headers" || \
     grep -qi 'robots.*noindex'      <<< "$body"; then
    pass "$label — noindex confirmed"
  else
    fail "$label — noindex NOT found (may expose to crawlers)"
  fi
}

# /login redirects after auth, check directly
login_body=$(http_body "$BASE_URL/login")
if grep -qi "noindex" <<< "$login_body"; then
  pass "/login — noindex in page metadata"
else
  fail "/login — noindex not found"
fi

verify_body=$(http_body "$BASE_URL/login/verify")
if grep -qi "noindex" <<< "$verify_body"; then
  pass "/login/verify — noindex in page metadata"
else
  fail "/login/verify — noindex not found"
fi

# ─────────────────────────────────────────────────────────────────
section "Security headers"
# ─────────────────────────────────────────────────────────────────

check_header() {
  local label="$1"
  local url="$2"
  local header_key="$3"
  local headers
  headers=$(curl -s -I --max-time 15 -H "User-Agent: GCI-SmokeTest/1.0" "$url")
  if grep -qi "$header_key" <<< "$headers"; then
    pass "$label"
  else
    fail "$label — header missing"
  fi
}

if [ "$MODE" = "local" ]; then
  skip "Security headers — 本番のみ検査 (local では HSTS 等が付かない)"
else
  check_header "X-Content-Type-Options"    "$BASE_URL/" "x-content-type-options"
  check_header "X-Frame-Options"           "$BASE_URL/" "x-frame-options"
  check_header "Strict-Transport-Security" "$BASE_URL/" "strict-transport-security"
  check_header "Referrer-Policy"           "$BASE_URL/" "referrer-policy"
fi

# ─────────────────────────────────────────────────────────────────
section "Admin app (data app)"
# ─────────────────────────────────────────────────────────────────

if [ "$MODE" = "local" ]; then
  # ローカルは認証なしで直接 200 を確認（新規ページ含む）
  check_page "Admin portfolio analytics"   "$DATA_URL/admin/portfolio"
  check_page "Admin portfolio CSV export"  "$DATA_URL/admin/portfolio/export"
  check_page "Admin cron logs"             "$DATA_URL/admin/logs"
  check_page "Admin feedback"              "$DATA_URL/admin/feedback"
  check_page "Admin prices"                "$DATA_URL/admin/prices"
else
  # 本番は Basic Auth — 401 が正
  status=$(http_status "$DATA_URL/admin")
  if [ "$status" = "401" ] || [ "$status" = "302" ]; then
    pass "Admin / — auth required ($status)"
  else
    fail "Admin / — expected 401 or 302, got $status"
  fi
  status=$(http_status "$DATA_URL/admin/portfolio")
  if [ "$status" = "401" ] || [ "$status" = "302" ]; then
    pass "Admin portfolio — auth required ($status)"
  else
    fail "Admin portfolio — expected 401/302, got $status"
  fi
fi

# ─────────────────────────────────────────────────────────────────
section "Cron dry-runs (data app — requires CRON_SECRET)"
# ─────────────────────────────────────────────────────────────────

if [ -z "$CRON_SECRET" ]; then
  skip "Cron dry-runs — set CRON_SECRET env var to enable"
else
  cron_check() {
    local label="$1"
    local path="$2"
    local body
    body=$(curl -s --max-time 30 \
      -H "Authorization: Bearer $CRON_SECRET" \
      -H "User-Agent: GCI-SmokeTest/1.0" \
      "$DATA_URL$path")
    if json_ok "$body"; then
      pass "$label"
    else
      fail "$label — $(echo "$body" | head -c 120)"
    fi
  }

  cron_check "watchlist-alerts dry-run"  "/api/v1/cron/watchlist-alerts?dry=1"
  cron_check "weekly-recap dry-run"       "/api/v1/cron/weekly-recap?dry=1"
  cron_check "health check"               "/api/v1/cron/health"
fi

# ─────────────────────────────────────────────────────────────────
section "Summary"
# ─────────────────────────────────────────────────────────────────

TOTAL=$((PASS + FAIL + SKIP))
echo ""
echo "  Total:  $TOTAL"
echo -e "  ${GREEN}Passed: $PASS${RESET}"
if [ "$FAIL" -gt 0 ]; then
  echo -e "  ${RED}Failed: $FAIL${RESET}"
else
  echo "  Failed: $FAIL"
fi
if [ "$SKIP" -gt 0 ]; then
  echo -e "  ${YELLOW}Skipped: $SKIP${RESET}"
fi
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}✗ Smoke test FAILED — $FAIL check(s) need attention.${RESET}"
  exit 1
else
  echo -e "${GREEN}✓ All checks passed.${RESET}"
  exit 0
fi
