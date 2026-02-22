#!/usr/bin/env bash
# ClawFinance Environment Validator
# Usage: bash clawfinance/scripts/validate-env.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$(cd "$SCRIPT_DIR/.." && pwd)/.env"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

ok()   { echo -e "  ${GREEN}✓${RESET} $1"; }
fail() { echo -e "  ${RED}✗${RESET} $1"; ERRORS=$((ERRORS+1)); }
warn() { echo -e "  ${YELLOW}~${RESET} $1 (optional)"; }

ERRORS=0

# Load .env if it exists
if [ -f "$ENV_FILE" ]; then
  set -o allexport
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +o allexport
else
  echo -e "${RED}[error]${RESET} .env file not found at $ENV_FILE"
  echo "  Run: cp clawfinance/.env.example clawfinance/.env"
  exit 1
fi

echo -e "${BOLD}Validating ClawFinance environment...${RESET}"
echo ""

# ─── Required vars ────────────────────────────────────────────────────────────
echo -e "${CYAN}Required:${RESET}"

check_required() {
  local key="$1" label="${2:-$1}"
  if [ -n "${!key:-}" ] && [ "${!key}" != "changeme_strong_password" ] && [ "${!key}" != "changeme_very_long_random_passphrase_for_aes256" ] && [ "${!key}" != "changeme_local_api_key" ]; then
    ok "$label"
  else
    fail "$label (${key} is not set or is the default placeholder)"
  fi
}

check_required DB_PASSWORD           "Database password"
check_required DB_ENCRYPTION_KEY     "Database encryption key"
check_required CLAWFINANCE_API_KEY   "ClawFinance API key"

echo ""

# ─── AI (strongly recommended) ───────────────────────────────────────────────
echo -e "${CYAN}AI Engine:${RESET}"
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  ok "ANTHROPIC_API_KEY (Claude agents will work)"
else
  fail "ANTHROPIC_API_KEY — required for all AI features. Get at console.anthropic.com"
fi

echo ""

# ─── Optional integrations ────────────────────────────────────────────────────
echo -e "${CYAN}Banking (optional — needed for transaction sync):${RESET}"
if [ -n "${PLAID_CLIENT_ID:-}" ] && [ -n "${PLAID_SECRET:-}" ]; then
  ok "Plaid (${PLAID_ENV:-sandbox} environment)"
else
  warn "Plaid not configured — get keys at dashboard.plaid.com"
fi

echo ""
echo -e "${CYAN}Investments (optional — needed for portfolio sync):${RESET}"
if [ -n "${SNAPTRADE_CLIENT_ID:-}" ] && [ -n "${SNAPTRADE_CONSUMER_KEY:-}" ]; then
  ok "SnapTrade"
else
  warn "SnapTrade not configured — get keys at app.snaptrade.com"
fi

echo ""
echo -e "${CYAN}Market Data (optional — needed for real-time quotes/news):${RESET}"
if [ -n "${FINNHUB_API_KEY:-}" ]; then
  ok "Finnhub"
else
  warn "Finnhub not configured — free tier at finnhub.io/register"
fi

echo ""
echo -e "${CYAN}Tax (optional — needed for document OCR):${RESET}"
if [ -n "${AZURE_DOC_INTEL_ENDPOINT:-}" ] && [ -n "${AZURE_DOC_INTEL_KEY:-}" ]; then
  ok "Azure Document Intelligence"
else
  warn "Azure Doc Intel not configured — get at portal.azure.com"
fi
if [ -n "${TAXBANDITS_API_KEY:-}" ]; then
  ok "TaxBandits"
else
  warn "TaxBandits not configured — get at taxbandits.com"
fi

echo ""
echo -e "${CYAN}Research & Sentiment (optional):${RESET}"
if [ -n "${TWITTER_API_KEY:-}" ] && [ -n "${TWITTER_API_SECRET:-}" ]; then
  ok "Twitter/X API"
else
  warn "Twitter/X not configured — get at developer.twitter.com"
fi
if [ -n "${SERPAPI_KEY:-}" ]; then
  ok "SerpAPI (Google Trends, job signals)"
else
  warn "SerpAPI not configured — free tier at serpapi.com"
fi

echo ""

# ─── Result ───────────────────────────────────────────────────────────────────
if [ $ERRORS -gt 0 ]; then
  echo -e "${RED}${BOLD}$ERRORS required variable(s) missing or using placeholder values.${RESET}"
  echo "Edit clawfinance/.env and re-run this script."
  exit 1
else
  echo -e "${GREEN}${BOLD}Required variables OK. ClawFinance can start.${RESET}"
fi
