#!/usr/bin/env bash
# =============================================================================
#  GCI 本番スモークテスト
#  Usage:
#    ./scripts/smoke-test.sh                          # デフォルト: https://globalcardindex.com
#    BASE_URL=https://staging.globalcardindex.com \
#      DATA_URL=https://staging-data.globalcardindex.com \
#      CRON_SECRET=xxx ./scripts/smoke-test.sh
#
#  Exit code: 0 = 全チェック合格 / 1 = 1件以上 FAIL
# =============================================================================
set -euo pipefail

BASE_URL="${BASE_URL:-https://globalcardindex.com}"
DATA_URL="${DATA_URL:-https://data.globalcardindex.com}"
CRON_SECRET="${CRON_SECRET:-}"

PASS=0
FAIL=0
SKIP=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
RESET='\033[0m'

pass()  { echo -e "${GREEN}  PASS${RESET}  $1"; ((PASS++)); }
fail()  { echo -e "${RED}  FAIL${RESET}  $1"; ((FAIL++)); }
skip()  { echo -e "${YELLOW}  SKIP${RESET}  $1 (env var not set)"; ((SKIP++)); }
section(){ echo ""; echo "── $1 ──────────────────────────────────────────"; }

# ── ヘルパー: HTTP ステータスコードを取得 ──────────────────────────
http_status() {
  curl -s -o /dev/null -w "%{http_code}" \
    -H "User-Agent: GCI-SmokeTest/1.0" \
    --max-time 15 \
    "$@"
}

# ── ヘルパー: レスポンスボディを取得 ──────────────────────────────
http_body() {
  curl -s --max-time 15 \
    -H "User-Agent: GCI-SmokeTest/1.0" \
    "$@"
}

# ── ヘルパー: JSON フィールドを確認 ───────────────────────────────
json_ok() {
  echo "$1" | grep -q '"ok":true'
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
  if [ "$status" = "$expect" ]; then
    pass "$label ($status)"
  else
    fail "$label — expected $expect, got $status ($url)"
  fi
}

check_page "Home /"                   "$BASE_URL/"
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
check_page "Login page"               "$BASE_URL/login"
check_page "Verify page"              "$BASE_URL/login/verify"
check_page "Account (→302 /login)"    "$BASE_URL/account" "302"

# ─────────────────────────────────────────────────────────────────
section "Static assets / feeds"
# ─────────────────────────────────────────────────────────────────

# sitemap.xml
body=$(http_body "$BASE_URL/sitemap.xml")
if echo "$body" | grep -q "<urlset"; then
  pass "Sitemap — valid XML with <urlset>"
else
  fail "Sitemap — <urlset> not found"
fi

# robots.txt
body=$(http_body "$BASE_URL/robots.txt")
if echo "$body" | grep -q "Disallow: /admin/"; then
  pass "robots.txt — /admin/ disallowed"
else
  fail "robots.txt — /admin/ not disallowed"
fi

# RSS feed
body=$(http_body "$BASE_URL/feed.xml")
if echo "$body" | grep -q "<rss"; then
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
status=$(http_status "$BASE_URL/api/auth/csrf")
if [ "$status" = "200" ]; then
  pass "Auth.js CSRF endpoint — 200"
else
  fail "Auth.js CSRF endpoint — $status"
fi

# Auth.js session endpoint (unauthenticated → 200 with null session)
body=$(http_body "$BASE_URL/api/auth/session")
if echo "$body" | grep -q "{}"; then
  pass "Auth.js session (unauth) — returns {}"
else
  # May return {"user":null} depending on Auth.js version
  if [ "$(http_status "$BASE_URL/api/auth/session")" = "200" ]; then
    pass "Auth.js session (unauth) — 200"
  else
    fail "Auth.js session endpoint — unexpected: $(echo "$body" | head -c 80)"
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
  if echo "$headers" | grep -qi "x-robots-tag.*noindex" || \
     echo "$body"   | grep -qi 'robots.*noindex'; then
    pass "$label — noindex confirmed"
  else
    fail "$label — noindex NOT found (may expose to crawlers)"
  fi
}

# /login redirects after auth, check directly
login_body=$(http_body "$BASE_URL/login")
if echo "$login_body" | grep -qi "noindex"; then
  pass "/login — noindex in page metadata"
else
  fail "/login — noindex not found"
fi

verify_body=$(http_body "$BASE_URL/login/verify")
if echo "$verify_body" | grep -qi "noindex"; then
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
  if echo "$headers" | grep -qi "$header_key"; then
    pass "$label"
  else
    fail "$label — header missing"
  fi
}

check_header "X-Content-Type-Options"    "$BASE_URL/" "x-content-type-options"
check_header "X-Frame-Options"           "$BASE_URL/" "x-frame-options"
check_header "Strict-Transport-Security" "$BASE_URL/" "strict-transport-security"
check_header "Referrer-Policy"           "$BASE_URL/" "referrer-policy"

# ─────────────────────────────────────────────────────────────────
section "Admin app (data app)"
# ─────────────────────────────────────────────────────────────────

# Admin requires Basic Auth — 401 on no credentials is correct
status=$(http_status "$DATA_URL/admin")
if [ "$status" = "401" ] || [ "$status" = "302" ]; then
  pass "Admin / — auth required ($status)"
else
  fail "Admin / — expected 401 or 302, got $status"
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
