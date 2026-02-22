#!/usr/bin/env python3
"""
calc_performance.py — Calculates portfolio performance metrics.

Reads holdings from the database and computes:
- Total portfolio value
- Daily, weekly, monthly, YTD returns (from net_worth_snapshots)
- Top/bottom performers
- Asset class breakdown
"""
import os, sys, json
from datetime import date, timedelta
from decimal import Decimal

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

def d(v) -> float:
    return float(v) if v is not None else 0.0

def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # Current holdings
    cur.execute("""
        SELECT h.ticker_symbol, h.security_name, h.security_type,
               h.quantity, h.cost_basis_total, h.market_price, h.market_value,
               h.unrealized_gain_loss, h.unrealized_gain_loss_pct, h.acquisition_date,
               a.account_name, a.institution_name
        FROM holdings h
        JOIN accounts a ON h.account_id = a.id
        WHERE a.is_active = true
        ORDER BY h.market_value DESC NULLS LAST
    """)
    holdings = cur.fetchall()

    total_value = sum(d(h["market_value"]) for h in holdings)
    total_cost = sum(d(h["cost_basis_total"]) for h in holdings)
    total_unrealized = sum(d(h["unrealized_gain_loss"]) for h in holdings)

    # Historical snapshots for return calculations
    today = date.today()
    periods = {
        "1d": today - timedelta(days=1),
        "1w": today - timedelta(weeks=1),
        "1m": today - timedelta(days=30),
        "3m": today - timedelta(days=90),
        "ytd": date(today.year, 1, 1),
    }
    returns = {}
    for label, start_date in periods.items():
        cur.execute(
            "SELECT net_worth FROM net_worth_snapshots WHERE date <= %s ORDER BY date DESC LIMIT 1",
            [start_date]
        )
        row = cur.fetchone()
        if row and d(row["net_worth"]) > 0:
            prior = d(row["net_worth"])
            returns[label] = {
                "prior_value": round(prior, 2),
                "change": round(total_value - prior, 2),
                "change_pct": round((total_value - prior) / prior * 100, 2),
            }
        else:
            returns[label] = None

    # Asset class breakdown
    asset_classes: dict[str, float] = {}
    for h in holdings:
        sec_type = h["security_type"] or "Other"
        asset_classes[sec_type] = asset_classes.get(sec_type, 0) + d(h["market_value"])

    # Concentration check: positions > 10%
    concentration = []
    if total_value > 0:
        for h in holdings:
            pct = d(h["market_value"]) / total_value * 100
            if pct > 10:
                concentration.append({"ticker": h["ticker_symbol"], "pct": round(pct, 1), "value": round(d(h["market_value"]), 2)})

    cur.close()
    conn.close()

    print(json.dumps({
        "status": "ok",
        "total_value": round(total_value, 2),
        "total_cost_basis": round(total_cost, 2),
        "total_unrealized_gain_loss": round(total_unrealized, 2),
        "total_unrealized_pct": round(total_unrealized / total_cost * 100, 2) if total_cost > 0 else 0,
        "returns": returns,
        "asset_classes": {k: {"value": round(v, 2), "pct": round(v / total_value * 100, 1) if total_value > 0 else 0} for k, v in asset_classes.items()},
        "concentration_risks": concentration,
        "top_positions": [
            {
                "ticker": h["ticker_symbol"], "name": h["security_name"],
                "value": round(d(h["market_value"]), 2),
                "unrealized_gl": round(d(h["unrealized_gain_loss"]), 2),
                "unrealized_gl_pct": round(d(h["unrealized_gain_loss_pct"]), 2),
            }
            for h in holdings[:10]
        ],
    }, default=str))

if __name__ == "__main__":
    main()
