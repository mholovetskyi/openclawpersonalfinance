#!/usr/bin/env python3
"""
calc_allocation.py — Computes asset allocation vs. target and flags drift.

Reads holdings from the database, groups by security_type and sector,
and compares to any target allocation stored in agent_state.
"""
import os, sys, json

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print(json.dumps({"status": "error", "message": "pip install psycopg2-binary"}))
    sys.exit(1)

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print(json.dumps({"status": "error", "message": "DATABASE_URL not set"}))
    sys.exit(1)

# Default target allocation (override via agent_state table)
DEFAULT_TARGET = {
    "equity": 70.0,
    "etf": 15.0,
    "bond": 10.0,
    "cash": 5.0,
}

def d(v) -> float:
    return float(v) if v is not None else 0.0

def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # Get target allocation from agent_state if set
    cur.execute("""
        SELECT metadata FROM agent_state
        WHERE agent_name = 'skill-investment' AND task_name = 'target_allocation'
        ORDER BY started_at DESC LIMIT 1
    """)
    target_row = cur.fetchone()
    target = target_row["metadata"] if target_row and target_row["metadata"] else DEFAULT_TARGET

    # Current holdings grouped by security_type
    cur.execute("""
        SELECT LOWER(COALESCE(h.security_type, 'other')) AS asset_class,
               SUM(h.market_value) AS total_value
        FROM holdings h
        JOIN accounts a ON h.account_id = a.id
        WHERE a.is_active = true
        GROUP BY LOWER(COALESCE(h.security_type, 'other'))
    """)
    rows = cur.fetchall()

    # Also include cash (depository accounts)
    cur.execute("""
        SELECT COALESCE(SUM(balance_current), 0) AS cash_balance
        FROM accounts WHERE type = 'depository' AND is_active = true
    """)
    cash_row = cur.fetchone()
    cash_value = d(cash_row["cash_balance"]) if cash_row else 0.0

    allocation: dict[str, float] = {"cash": cash_value}
    for row in rows:
        allocation[row["asset_class"]] = d(row["total_value"])

    total = sum(allocation.values())

    current_pct: dict[str, float] = {}
    if total > 0:
        for k, v in allocation.items():
            current_pct[k] = round(v / total * 100, 1)

    # Drift analysis
    drift = []
    for asset_class, target_pct in target.items():
        current = current_pct.get(asset_class, 0.0)
        diff = current - target_pct
        if abs(diff) > 5:
            drift.append({
                "asset_class": asset_class,
                "target_pct": target_pct,
                "current_pct": current,
                "drift_pct": round(diff, 1),
                "action": "reduce" if diff > 0 else "increase",
            })

    cur.close()
    conn.close()

    print(json.dumps({
        "status": "ok",
        "total_portfolio_value": round(total, 2),
        "current_allocation": {k: {"value": round(v, 2), "pct": current_pct.get(k, 0)} for k, v in allocation.items()},
        "target_allocation": target,
        "drift": drift,
        "rebalance_needed": len(drift) > 0,
    }))

if __name__ == "__main__":
    main()
