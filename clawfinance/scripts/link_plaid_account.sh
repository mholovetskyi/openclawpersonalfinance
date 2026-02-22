#!/usr/bin/env bash
set -euo pipefail
# Plaid Link flow helper.
# Runs a minimal Express server that opens Plaid Link in the browser,
# captures the public_token, exchanges it for an access_token,
# and stores the encrypted token in the database.
#
# TODO (Phase 2): Implement this script.
# For now, test with Plaid Sandbox credentials.

echo "🦞 Plaid Account Linking"
echo ""
echo "Phase 1 stub — full Plaid Link UI comes in Phase 2."
echo ""
echo "To test with Plaid Sandbox now:"
echo "  Set PLAID_ENV=sandbox in .env"
echo "  Use sandbox credentials: username=user_good, password=pass_good"
echo ""
echo "Plaid docs: https://plaid.com/docs/quickstart/"
