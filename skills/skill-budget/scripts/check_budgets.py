#!/usr/bin/env python3
"""
check_budgets.py

Compares current month spending by category against budget limits.
Also detects recurring charges and unusual transactions.

Output: JSON printed to stdout with keys:
  on_track, warning, over_budget, recurring, unusual_transactions
"""

import os
import sys
import json
from datetime import date
from decimal import Decimal
from collections import defaultdict

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print(json.dumps({"status": "error", "message": "psycopg2 not installed. Run: pip install psycopg2-binary"}))
    sys.exit(1)

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print(json.dumps({"status": "error", "message": "DATABASE_URL not set"}))
    sys.exit(1)


def d(val) -> float:
    """Convert Decimal/None to float."""
    return float(val) if val is not None else 0.0


def main():
    today = date.today()
    start_of_month = today.replace(day=1).isoformat()
    # Last day of this month
    if today.month == 12:
        end_of_month = today.replace(month=12, day=31).isoformat()
    else:
        end_of_month = today.replace(month=today.month + 1, day=1).replace(day=1)
        # subtract 1 day
        from datetime import timedelta
        end_of_month = (date(today.year, today.month + 1, 1) - timedelta(days=1)).isoformat()

    # Last month for MoM comparison
    if today.month == 1:
        last_month_start = date(today.year - 1, 12, 1).isoformat()
        last_month_end = date(today.year - 1, 12, 31).isoformat()
    else:
        import calendar
        last_year, last_mon = (today.year, today.month - 1)
        last_day = calendar.monthrange(last_year, last_mon)[1]
        last_month_start = date(last_year, last_mon, 1).isoformat()
        last_month_end = date(last_year, last_mon, last_day).isoformat()

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # ── Budget vs spend ───────────────────────────────────────────
    cur.execute(
        """
        SELECT
            b.category,
            b.monthly_limit,
            COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0) AS spent
        FROM budgets b
        LEFT JOIN transactions t
            ON t.category = b.category
           AND t.date BETWEEN %s AND %s
           AND t.pending = false
        WHERE b.is_active = true
        GROUP BY b.id
        ORDER BY b.category
        """,
        [start_of_month, end_of_month]
    )
    budget_rows = cur.fetchall()

    on_track = []
    warning = []
    over_budget = []

    for row in budget_rows:
        limit = d(row["monthly_limit"])
        spent = d(row["spent"])
        pct = (spent / limit * 100) if limit > 0 else 0.0
        entry = {
            "category": row["category"],
            "budget": round(limit, 2),
            "spent": round(spent, 2),
            "pct_used": round(pct, 1),
        }
        if pct > 100:
            over_budget.append(entry)
        elif pct >= 80:
            warning.append(entry)
        else:
            on_track.append(entry)

    # ── Recurring charges (transactions appearing > 1x in last 3 months) ──
    cur.execute(
        """
        SELECT
            COALESCE(merchant_name, name) AS merchant,
            COUNT(*) AS occurrences,
            AVG(amount) AS avg_amount,
            MAX(date) AS last_seen
        FROM transactions
        WHERE date >= (CURRENT_DATE - INTERVAL '90 days')
          AND amount > 0
          AND pending = false
        GROUP BY COALESCE(merchant_name, name)
        HAVING COUNT(*) >= 2 AND STDDEV(amount) < AVG(amount) * 0.1
        ORDER BY avg_amount DESC
        LIMIT 20
        """,
    )
    recurring_rows = cur.fetchall()
    recurring = [
        {
            "merchant": row["merchant"],
            "amount": round(d(row["avg_amount"]), 2),
            "occurrences_90d": int(row["occurrences"]),
            "last_seen": str(row["last_seen"]),
            "frequency": "monthly" if int(row["occurrences"]) <= 3 else "weekly",
        }
        for row in recurring_rows
    ]

    # ── Unusual transactions (> 3x category average) ──────────────
    cur.execute(
        """
        SELECT
            t.id,
            t.name,
            t.merchant_name,
            t.category,
            t.amount,
            t.date,
            cat_avg.avg_amount
        FROM transactions t
        JOIN (
            SELECT category, AVG(amount) AS avg_amount
            FROM transactions
            WHERE date >= (CURRENT_DATE - INTERVAL '90 days')
              AND amount > 0 AND pending = false
            GROUP BY category
        ) cat_avg ON t.category = cat_avg.category
        WHERE t.date BETWEEN %s AND %s
          AND t.amount > cat_avg.avg_amount * 3
          AND t.amount > 0
          AND t.pending = false
        ORDER BY t.amount DESC
        LIMIT 10
        """,
        [start_of_month, end_of_month]
    )
    unusual_rows = cur.fetchall()
    unusual_transactions = [
        {
            "id": str(row["id"]),
            "name": row["name"],
            "category": row["category"],
            "amount": round(d(row["amount"]), 2),
            "date": str(row["date"]),
            "category_avg": round(d(row["avg_amount"]), 2),
            "multiple": round(d(row["amount"]) / d(row["avg_amount"]), 1) if d(row["avg_amount"]) > 0 else None,
        }
        for row in unusual_rows
    ]

    cur.close()
    conn.close()

    result = {
        "status": "ok",
        "period": {"start": start_of_month, "end": end_of_month},
        "on_track": on_track,
        "warning": warning,
        "over_budget": over_budget,
        "recurring": recurring,
        "unusual_transactions": unusual_transactions,
        "summary": {
            "categories_on_track": len(on_track),
            "categories_warning": len(warning),
            "categories_over_budget": len(over_budget),
            "recurring_charges_detected": len(recurring),
        },
    }
    print(json.dumps(result, default=str))


if __name__ == "__main__":
    main()
