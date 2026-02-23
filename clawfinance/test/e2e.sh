#!/usr/bin/env bash
# ClawFinance E2E Config & Build Validation
# Validates configuration, builds, and static correctness without requiring
# running services or real API keys.
#
# Usage (from repo root):
#   bash clawfinance/test/e2e.sh
#
# Exit codes:
#   0 — all checks passed
#   1 — one or more checks failed

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CF="$REPO_ROOT/clawfinance"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

PASS=0; FAIL=0; WARN=0

pass() { echo -e "  ${GREEN}✓${RESET} $1"; PASS=$((PASS+1)); }
fail() { echo -e "  ${RED}✗${RESET} $1"; FAIL=$((FAIL+1)); }
warn() { echo -e "  ${YELLOW}~${RESET} $1"; WARN=$((WARN+1)); }
section() { echo ""; echo -e "${CYAN}${BOLD}▶ $1${RESET}"; }

echo -e "${BOLD}🦞 ClawFinance E2E Validation${RESET}"
echo "────────────────────────────────────────────────"

# ─── 1. Docker Compose config ────────────────────────────────────────────────
section "Docker Compose"

if command -v docker >/dev/null 2>&1; then
  if docker compose config --quiet 2>/dev/null; then
    pass "docker compose config is valid"
  else
    fail "docker compose config failed"
  fi

  # Verify ClawFinance services are present
  for svc in postgres redis api ui; do
    if docker compose config 2>/dev/null | grep -q "  ${svc}:"; then
      pass "service '${svc}' defined in compose"
    else
      fail "service '${svc}' missing from compose"
    fi
  done
else
  warn "Docker not available — skipping compose validation"
fi

# ─── 2. .openclaw.json ────────────────────────────────────────────────────────
section ".openclaw.json"

OPENCLAW_JSON="$REPO_ROOT/.openclaw.json"
if [ -f "$OPENCLAW_JSON" ]; then
  if python3 -m json.tool "$OPENCLAW_JSON" > /dev/null 2>&1; then
    pass ".openclaw.json is valid JSON"
  else
    fail ".openclaw.json is not valid JSON"
  fi

  # Verify all 7 MCP servers are registered
  for mcp in plaid snaptrade finnhub sec azure-doc-intel twitter altdata; do
    if python3 -c "import json,sys; d=json.load(open('$OPENCLAW_JSON')); sys.exit(0 if '$mcp' in d.get('mcpServers',{}) else 1)" 2>/dev/null; then
      pass "MCP server '${mcp}' registered"
    else
      fail "MCP server '${mcp}' missing from .openclaw.json"
    fi
  done

  # Verify cron jobs exist
  JOB_COUNT=$(python3 -c "import json; d=json.load(open('$OPENCLAW_JSON')); print(len(d.get('cron',{}).get('jobs',[])))" 2>/dev/null || echo 0)
  if [ "$JOB_COUNT" -ge 8 ]; then
    pass "${JOB_COUNT} cron jobs defined"
  else
    fail "Expected ≥8 cron jobs, found ${JOB_COUNT}"
  fi

  # Verify MCP server dist paths reference the clawfinance subdirectory
  if grep -q '"./clawfinance/mcp-servers/' "$OPENCLAW_JSON"; then
    pass "MCP server paths are relative to repo root"
  else
    fail "MCP server paths may not be correct — expected ./clawfinance/mcp-servers/"
  fi
else
  fail ".openclaw.json not found at $OPENCLAW_JSON"
fi

# ─── 3. .env.example completeness ────────────────────────────────────────────
section ".env.example"

ENV_EXAMPLE="$REPO_ROOT/.env.example"
REQUIRED_KEYS=(
  DB_PASSWORD
  DB_ENCRYPTION_KEY
  CLAWFINANCE_API_KEY
  PLAID_CLIENT_ID
  PLAID_SECRET
  SNAPTRADE_CLIENT_ID
  SNAPTRADE_CONSUMER_KEY
  FINNHUB_API_KEY
  ANTHROPIC_API_KEY
)

if [ -f "$ENV_EXAMPLE" ]; then
  pass ".env.example exists"
  for key in "${REQUIRED_KEYS[@]}"; do
    if grep -q "^${key}=" "$ENV_EXAMPLE" || grep -q "# *${key}=" "$ENV_EXAMPLE"; then
      pass "${key} present in .env.example"
    else
      fail "${key} missing from .env.example"
    fi
  done
else
  fail ".env.example not found"
fi

# ─── 4. Shell script syntax ──────────────────────────────────────────────────
section "Shell scripts (bash -n)"

SH_FILES=(
  "$REPO_ROOT/setup.sh"
  "$CF/scripts/setup.sh"
  "$CF/scripts/validate-env.sh"
)
for f in "${SH_FILES[@]}"; do
  if [ -f "$f" ]; then
    if bash -n "$f" 2>/dev/null; then
      pass "$(basename "$f") — syntax OK"
    else
      fail "$(basename "$f") — syntax error"
    fi
  else
    warn "$(basename "$f") not found"
  fi
done

# ─── 5. Python script syntax ─────────────────────────────────────────────────
section "Python scripts (py_compile)"

if command -v python3 >/dev/null 2>&1; then
  while IFS= read -r -d '' pyfile; do
    if python3 -m py_compile "$pyfile" 2>/dev/null; then
      pass "$(basename "$pyfile")"
    else
      fail "$(basename "$pyfile") — syntax error"
    fi
  done < <(find "$REPO_ROOT/skills" -name "*.py" -print0 2>/dev/null)
else
  warn "python3 not available — skipping Python syntax checks"
fi

# ─── 6. MCP server package.json files ────────────────────────────────────────
section "MCP server package.json files"

for mcp_dir in "$CF/mcp-servers"/*/; do
  name=$(basename "$mcp_dir")
  pkg="$mcp_dir/package.json"
  if [ -f "$pkg" ]; then
    if python3 -m json.tool "$pkg" > /dev/null 2>&1; then
      # Verify build and dev scripts exist
      if python3 -c "import json; d=json.load(open('$pkg')); assert 'build' in d.get('scripts',{})" 2>/dev/null; then
        pass "${name}/package.json valid (has build script)"
      else
        fail "${name}/package.json missing 'build' script"
      fi
    else
      fail "${name}/package.json is invalid JSON"
    fi
  else
    fail "${name}/package.json not found"
  fi
done

# ─── 7. TypeScript type-check ────────────────────────────────────────────────
section "TypeScript (tsc --noEmit)"

if command -v node >/dev/null 2>&1; then
  # API
  if [ -f "$CF/api/tsconfig.json" ]; then
    if (cd "$CF/api" && npx --yes tsc --noEmit 2>&1 | head -20); then
      pass "clawfinance/api — TypeScript OK"
    else
      fail "clawfinance/api — TypeScript errors"
    fi
  else
    warn "clawfinance/api/tsconfig.json not found"
  fi

  # UI
  if [ -f "$CF/ui/tsconfig.json" ]; then
    if (cd "$CF/ui" && npx --yes tsc --noEmit 2>&1 | head -20); then
      pass "clawfinance/ui — TypeScript OK"
    else
      fail "clawfinance/ui — TypeScript errors"
    fi
  else
    warn "clawfinance/ui/tsconfig.json not found"
  fi
else
  warn "node not available — skipping TypeScript checks"
fi

# ─── 8. MCP server TypeScript check ─────────────────────────────────────────
section "MCP servers (tsc --noEmit)"

for mcp_dir in "$CF/mcp-servers"/*/; do
  name=$(basename "$mcp_dir")
  if [ -f "$mcp_dir/tsconfig.json" ]; then
    if (cd "$mcp_dir" && npx --yes tsc --noEmit 2>/dev/null); then
      pass "${name} — TypeScript OK"
    else
      fail "${name} — TypeScript errors (run: cd $mcp_dir && tsc --noEmit)"
    fi
  else
    warn "${name}/tsconfig.json not found"
  fi
done

# ─── 9. API unit tests ───────────────────────────────────────────────────────
section "API unit tests (vitest)"

if [ -f "$CF/api/package.json" ] && [ -d "$CF/api/node_modules" ]; then
  if (cd "$CF/api" && npm test 2>&1); then
    pass "API unit tests passed"
  else
    fail "API unit tests failed"
  fi
else
  warn "API deps not installed — skipping unit tests (run: cd clawfinance/api && npm install)"
fi

# ─── 10. Summary ─────────────────────────────────────────────────────────────
echo ""
echo "────────────────────────────────────────────────"
echo -e "${BOLD}Results: ${GREEN}${PASS} passed${RESET}  ${RED}${FAIL} failed${RESET}  ${YELLOW}${WARN} warnings${RESET}"
echo ""

if [ $FAIL -gt 0 ]; then
  echo -e "${RED}${BOLD}E2E validation FAILED — fix ${FAIL} error(s) above.${RESET}"
  exit 1
else
  echo -e "${GREEN}${BOLD}E2E validation PASSED.${RESET}"
fi
