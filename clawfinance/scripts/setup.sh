#!/usr/bin/env bash
# ClawFinance Setup Script (legacy entry point — prefer: bash setup.sh from repo root)
# Usage: bash clawfinance/scripts/setup.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# ROOT = repo root (two levels up from clawfinance/scripts/)
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# Subdir containing ClawFinance application code
CF="$ROOT/clawfinance"

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[info]${RESET} $*"; }
success() { echo -e "${GREEN}[ok]${RESET}   $*"; }
warn()    { echo -e "${YELLOW}[warn]${RESET} $*"; }
error()   { echo -e "${RED}[error]${RESET} $*" >&2; }
die()     { error "$*"; exit 1; }

echo -e "${BOLD}🦞 ClawFinance Setup${RESET}"
echo "──────────────────────────────────────────────────"

# ─── 1. Check prerequisites ────────────────────────────────────────────────────
info "Checking prerequisites..."

command -v docker >/dev/null 2>&1 || die "Docker is not installed. Install from https://docs.docker.com/get-docker/"
command -v docker compose >/dev/null 2>&1 || \
  command -v docker-compose >/dev/null 2>&1 || \
  die "Docker Compose is not installed. Install Docker Desktop or 'docker compose' plugin."
command -v node >/dev/null 2>&1 || die "Node.js is not installed. Install from https://nodejs.org (v22+ recommended)"

NODE_VER=$(node -e "process.stdout.write(process.versions.node)")
NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  warn "Node.js $NODE_VER detected. v18+ is required, v22 recommended."
fi

success "Prerequisites OK (Docker, Node $NODE_VER)"

# ─── 2. Environment file ────────────────────────────────────────────────────────
info "Setting up environment..."

if [ ! -f "$ROOT/.env" ]; then
  cp "$ROOT/.env.example" "$ROOT/.env"
  success "Created .env from .env.example"
  echo ""
  echo -e "${YELLOW}  ACTION REQUIRED: Edit $ROOT/.env${RESET}"
  echo "  At minimum, set:"
  echo "    DB_PASSWORD=<strong-random-password>"
  echo "    DB_ENCRYPTION_KEY=<32+ char random string>"
  echo "    CLAWFINANCE_API_KEY=<your-local-api-key>"
  echo "    ANTHROPIC_API_KEY=<your-anthropic-key>"
  echo ""
  echo "  Optional integrations (add as needed):"
  echo "    PLAID_CLIENT_ID / PLAID_SECRET     — bank accounts"
  echo "    SNAPTRADE_CLIENT_ID / ...          — brokerage accounts"
  echo "    FINNHUB_API_KEY                    — market data"
  echo "    AZURE_DOC_INTEL_*                  — tax document OCR"
  echo ""
  read -rp "  Press ENTER after editing .env to continue, or Ctrl+C to exit... "
else
  success ".env already exists"
fi

# ─── 3. Validate required env vars ────────────────────────────────────────────
info "Validating environment..."
bash "$SCRIPT_DIR/validate-env.sh"

# ─── 4. Install Node dependencies ─────────────────────────────────────────────
info "Installing Node.js dependencies..."

install_deps() {
  local dir="$1" name="$2"
  if [ -d "$dir" ]; then
    info "  npm install → $name"
    (cd "$dir" && npm install --silent)
    success "  $name deps installed"
  fi
}

install_deps "$CF/api" "API"
install_deps "$CF/ui" "UI"

# Install MCP server deps
for mcp_dir in "$CF/mcp-servers"/*/; do
  if [ -f "$mcp_dir/package.json" ]; then
    mcp_name=$(basename "$mcp_dir")
    install_deps "$mcp_dir" "$mcp_name"
  fi
done

# ─── 5. Start Docker services ─────────────────────────────────────────────────
info "Starting Docker services..."

(cd "$ROOT" && docker compose up -d --build 2>&1 | grep -v "^#" | tail -20) || \
(cd "$ROOT" && docker-compose up -d --build 2>&1 | grep -v "^#" | tail -20)

# Wait for API to become healthy
info "Waiting for API to be ready..."
MAX_WAIT=60
elapsed=0
while ! curl -sf "http://localhost:3001/health" >/dev/null 2>&1; do
  if [ $elapsed -ge $MAX_WAIT ]; then
    warn "API health check timed out after ${MAX_WAIT}s. Check: docker compose logs api"
    break
  fi
  sleep 2
  elapsed=$((elapsed+2))
done

if curl -sf "http://localhost:3001/health" >/dev/null 2>&1; then
  success "API is healthy at http://localhost:3001"
fi

# ─── 6. Done ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}✓ ClawFinance is running!${RESET}"
echo ""
echo "  UI:      http://localhost:5173"
echo "  API:     http://localhost:3001"
echo "  Health:  http://localhost:3001/api/health"
echo ""
echo "  Settings / API key management → http://localhost:5173/settings"
echo ""
echo -e "${CYAN}Next steps:${RESET}"
echo "  1. Open http://localhost:5173/settings to configure integrations"
echo "  2. Connect your Plaid bank accounts (requires Plaid API keys)"
echo "  3. Connect brokerage accounts via SnapTrade"
echo "  4. Start the OpenClaw agent: cd <repo-root> && openclaw start"
echo ""
echo "  See README.md for full documentation."
