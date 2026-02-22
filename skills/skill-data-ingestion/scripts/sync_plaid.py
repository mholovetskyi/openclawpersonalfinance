#!/usr/bin/env python3
"""
sync_plaid.py — Syncs bank transactions and balances from Plaid.

Phase 1 stub. Full implementation in Phase 2.
"""

import os
import sys
import json
from datetime import date, timedelta

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print(json.dumps({"status": "error", "message": "DATABASE_URL not set"}))
    sys.exit(1)

# TODO (Phase 2):
# 1. Connect to PostgreSQL using psycopg2
# 2. SELECT accounts WHERE api_source = 'plaid' AND is_active = true
# 3. For each account, decrypt access_token_encrypted with pgcrypto
# 4. Call Plaid API (or MCP server) to fetch transactions
# 5. Upsert into transactions table
# 6. Update account balances
# 7. Write net_worth_snapshot

print(json.dumps({
    "status": "stub",
    "message": "sync_plaid.py is a Phase 2 stub. Implement after linking a Plaid account.",
}))
