#!/usr/bin/env bash
# ClawFinance + OpenClaw — one-shot setup
# Run from the repo root: bash setup.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[info]${RESET} $*"; }
success() { echo -e "${GREEN}[ok]${RESET}   $*"; }
warn()    { echo -e "${YELLOW}[warn]${RESET} $*"; }
error()   { echo -e "${RED}[error]${RESET} $*" >&2; }
die()     { error "$*"; exit 1; }

echo -e "${BOLD}🦞 ClawFinance + OpenClaw Setup${RESET}"
echo "──────────────────────────────────────────────────"

# ─── 1. Prerequisites ─────────────────────────────────────────────────────────
info "Checking prerequisites..."

command -v docker >/dev/null 2>&1 || die "Docker not found. Install from https://docs.docker.com/get-docker/"
docker compose version >/dev/null 2>&1 || \
  command -v docker-compose >/dev/null 2>&1 || \
  die "Docker Compose not found. Install Docker Desktop or the 'compose' plugin."
command -v node >/dev/null 2>&1 || die "Node.js not found. Install from https://nodejs.org (v22+)"

NODE_MAJOR=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
[ "$NODE_MAJOR" -ge 18 ] || warn "Node $NODE_MAJOR detected; v22 recommended."

success "Docker + Node $(node -v) OK"

# ─── 2. Environment file ──────────────────────────────────────────────────────
info "Setting up environment..."

ENV_FILE="$ROOT/.env"
if [ ! -f "$ENV_FILE" ]; then
  cp "$ROOT/.env.example" "$ENV_FILE"
  success "Created .env from .env.example"
  echo ""
  echo -e "${YELLOW}  ACTION REQUIRED: Edit .env before continuing${RESET}"
  echo ""
  echo "  Required fields:"
  echo "    DB_PASSWORD          — strong random password for Postgres"
  echo "    DB_ENCRYPTION_KEY    — 32+ char random string for AES-256"
  echo "    CLAWFINANCE_API_KEY  — any random string for local API auth"
  echo "    ANTHROPIC_API_KEY    — from console.anthropic.com"
  echo ""
  echo "  Optional (enable features as you need them):"
  echo "    PLAID_CLIENT_ID / PLAID_SECRET     — bank account sync"
  echo "    SNAPTRADE_CLIENT_ID / ...          — brokerage sync"
  echo "    FINNHUB_API_KEY                    — market data + news"
  echo "    AZURE_DOC_INTEL_*                  — tax document OCR"
  echo ""
  read -rp "  Press ENTER after editing .env to continue, or Ctrl+C to exit... "
else
  success ".env already exists"
fi

# ─── 3. Validate env ──────────────────────────────────────────────────────────
bash "$ROOT/clawfinance/scripts/validate-env.sh"

# ─── 4. Build MCP servers ─────────────────────────────────────────────────────
info "Building ClawFinance MCP servers..."

MCP_DIRS=(
  "$ROOT/clawfinance/mcp-servers/mcp-plaid"
  "$ROOT/clawfinance/mcp-servers/mcp-snaptrade"
  "$ROOT/clawfinance/mcp-servers/mcp-finnhub"
  "$ROOT/clawfinance/mcp-servers/mcp-sec"
  "$ROOT/clawfinance/mcp-servers/mcp-azure-doc-intel"
  "$ROOT/clawfinance/mcp-servers/mcp-twitter"
  "$ROOT/clawfinance/mcp-servers/mcp-altdata"
)

for dir in "${MCP_DIRS[@]}"; do
  name=$(basename "$dir")
  if [ -d "$dir" ]; then
    info "  Building $name..."
    (cd "$dir" && npm install --silent && npm run build --silent)
    success "  $name built"
  else
    warn "  $name not found — skipping"
  fi
done

# ─── 5. Start Docker services ─────────────────────────────────────────────────
info "Starting ClawFinance services (Postgres, Redis, API, UI)..."

(cd "$ROOT" && docker compose up -d --build 2>&1 | tail -20)

# ─── 6. Wait for API health ───────────────────────────────────────────────────
info "Waiting for API to be ready..."
MAX_WAIT=90; elapsed=0
until curl -sf "http://localhost:3001/api/health" >/dev/null 2>&1; do
  [ $elapsed -ge $MAX_WAIT ] && { warn "API health check timed out. Check: docker compose logs api"; break; }
  sleep 3; elapsed=$((elapsed+3))
done
curl -sf "http://localhost:3001/api/health" >/dev/null 2>&1 && success "API healthy at http://localhost:3001"

# ─── 7. Done ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}✓ ClawFinance is running!${RESET}"
echo ""
echo "  UI:     http://localhost:5173"
echo "  API:    http://localhost:3001"
echo ""
echo -e "${CYAN}Start the OpenClaw agent (in a second terminal):${RESET}"
echo "  pnpm install && pnpm run dev"
echo ""
echo -e "${CYAN}Or run OpenClaw in Docker (optional):${RESET}"
echo "  docker compose --profile gateway up -d"
echo ""
echo "See README.md for full documentation."
