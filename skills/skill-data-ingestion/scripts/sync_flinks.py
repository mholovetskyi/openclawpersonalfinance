#!/usr/bin/env python3
"""
sync_flinks.py — Syncs bank accounts and transactions from Flinks.

Flinks is a Canadian open-banking platform (Montreal) that aggregates data from
15,000+ North American financial institutions. This script refreshes all active
Flinks-linked accounts by:
  1. Querying accounts WHERE api_source = 'flinks' AND is_active = true
  2. Grouping by flinks_login_id (one login = one bank connection)
  3. Calling POST /api/flinks/sync on the ClawFinance API to trigger a refresh
"""

import os
import sys
import json

try:
    import requests
except ImportError:
    print(json.dumps({"status": "error", "message": "requests library not installed. Run: pip install requests"}))
    sys.exit(1)

API_BASE = os.environ.get("CLAWFINANCE_API_URL", "http://localhost:3001")
API_KEY = os.environ.get("CLAWFINANCE_API_KEY", "")

def main():
    headers = {"Content-Type": "application/json"}
    if API_KEY:
        headers["x-api-key"] = API_KEY

    try:
        resp = requests.post(f"{API_BASE}/api/flinks/sync", headers=headers, timeout=120)
        resp.raise_for_status()
        result = resp.json()
        print(json.dumps({
            "status": "ok",
            "accounts_synced": result.get("accounts_synced", 0),
            "errors": result.get("errors"),
        }))
    except requests.exceptions.ConnectionError:
        print(json.dumps({
            "status": "error",
            "message": f"Could not connect to ClawFinance API at {API_BASE}",
        }))
        sys.exit(1)
    except requests.exceptions.HTTPError as e:
        print(json.dumps({
            "status": "error",
            "message": f"API returned {e.response.status_code}: {e.response.text}",
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()
