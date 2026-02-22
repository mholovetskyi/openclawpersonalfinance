#!/usr/bin/env python3
"""
find_tax_loss_harvest.py — Identifies tax-loss harvesting opportunities.

Finds positions with unrealized losses > $1,000 and checks for wash-sale risk
(same security purchased within 30 days before or after any potential sale).
Estimates tax savings based on short-term vs long-term capital gains rates.
"""
import os, sys, json
from datetime import date, timedelta

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

# Approximate tax rates for estimation
SHORT_TERM_RATE = 0.37  # Highest bracket for worst-case
LONG_TERM_RATE = 0.20   # Highest LTCG rate

def d(v) -> float:
    return float(v) if v is not None else 0.0

def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    today = date.today()

    # Find positions with unrealized losses > $1,000
    cur.execute("""
        SELECT h.id, h.ticker_symbol, h.security_name, h.quantity,
               h.cost_basis_total, h.market_value, h.unrealized_gain_loss,
               h.acquisition_date,
               a.account_name
        FROM holdings h
        JOIN accounts a ON h.account_id = a.id
        WHERE h.unrealized_gain_loss < -1000
          AND a.is_active = true
        ORDER BY h.unrealized_gain_loss ASC
    """)
    loss_positions = cur.fetchall()

    opportunities = []
    for pos in loss_positions:
        loss = abs(d(pos["unrealized_gain_loss"]))
        acq_date = pos["acquisition_date"]
        is_long_term = acq_date and (today - acq_date).days > 365 if acq_date else False
        tax_rate = LONG_TERM_RATE if is_long_term else SHORT_TERM_RATE
        estimated_savings = round(loss * tax_rate, 2)

        # Wash-sale check: any buy of same ticker in last 30 days
        cur.execute("""
            SELECT COUNT(*) AS cnt FROM transactions
            WHERE name ILIKE %s
              AND amount < 0
              AND date >= %s
              AND date <= %s
        """, [f"%{pos['ticker_symbol']}%", today - timedelta(days=30), today + timedelta(days=30)])
        wash_row = cur.fetchone()
        wash_sale_risk = (wash_row["cnt"] or 0) > 0

        opportunities.append({
            "ticker": pos["ticker_symbol"],
            "security_name": pos["security_name"],
            "unrealized_loss": round(d(pos["unrealized_gain_loss"]), 2),
            "market_value": round(d(pos["market_value"]), 2),
            "holding_period_days": (today - acq_date).days if acq_date else None,
            "is_long_term": is_long_term,
            "estimated_tax_savings": estimated_savings,
            "wash_sale_risk": wash_sale_risk,
            "account": pos["account_name"],
        })

    cur.close()
    conn.close()

    actionable = [o for o in opportunities if not o["wash_sale_risk"]]
    total_potential_savings = sum(o["estimated_tax_savings"] for o in actionable)

    print(json.dumps({
        "status": "ok",
        "opportunities": opportunities,
        "actionable_count": len(actionable),
        "total_potential_tax_savings": round(total_potential_savings, 2),
        "note": "Wash-sale rule: avoid buying the same security 30 days before/after harvesting.",
    }))

if __name__ == "__main__":
    main()
