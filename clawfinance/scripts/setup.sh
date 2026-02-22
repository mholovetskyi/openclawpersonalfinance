#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🦞 ClawFinance Setup"
echo "===================="

# ── Check prerequisites ───────────────────────────────────────────
check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    echo "❌ '$1' not found. Please install it first."
    exit 1
  fi
}

check_cmd docker
check_cmd node

NODE_VER=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 22 ]; then
  echo "❌ Node.js 22+ required (found: $(node --version))"
  exit 1
fi

echo "✅ Docker: $(docker --version | head -1)"
echo "✅ Node:   $(node --version)"

# ── Copy .env if missing ──────────────────────────────────────────
if [ ! -f "$ROOT/.env" ]; then
  cp "$ROOT/.env.example" "$ROOT/.env"
  echo ""
  echo "📝 Created .env from .env.example"
  echo "   → Edit $ROOT/.env with your API keys before proceeding."
fi

# ── Install dependencies ──────────────────────────────────────────
echo ""
echo "📦 Installing API dependencies..."
(cd "$ROOT/api" && npm install --silent)

echo "📦 Installing UI dependencies..."
(cd "$ROOT/ui" && npm install --silent)

echo "📦 Installing Plaid MCP server dependencies..."
(cd "$ROOT/mcp-servers/mcp-plaid" && npm install --silent)

# ── Build MCP server ──────────────────────────────────────────────
echo ""
echo "🔨 Building Plaid MCP server..."
(cd "$ROOT/mcp-servers/mcp-plaid" && npm run build)

# ── Start Docker services ─────────────────────────────────────────
echo ""
echo "🐳 Starting Docker services (postgres, redis, api, ui)..."
(cd "$ROOT" && docker compose up -d --build)

echo ""
echo "✅ ClawFinance Phase 1 is running!"
echo ""
echo "   Dashboard:  http://localhost:5173"
echo "   API:        http://localhost:3001"
echo "   Health:     http://localhost:3001/health"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your Plaid API keys"
echo "  2. Run the Plaid Link flow to connect your first account:"
echo "     bash scripts/link_plaid_account.sh"
echo "  3. Ask the ClawFinance agent: 'What is my net worth?'"
