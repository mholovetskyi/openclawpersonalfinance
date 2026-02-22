#!/usr/bin/env python3
"""
categorize_transactions.py

Assigns categories to transactions that have category IS NULL.
Uses Plaid's category data where present, falls back to merchant name
keyword mapping for common merchants.

Output: JSON summary printed to stdout.
"""

import os
import sys
import json
import re

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

# Simple keyword → category mapping for common merchants
KEYWORD_CATEGORIES: list[tuple[re.Pattern, str, str]] = [
    (re.compile(r"netflix|spotify|hulu|disney\+|apple tv|hbo|peacock|paramount", re.I), "Entertainment", "Streaming"),
    (re.compile(r"amazon|walmart|target|costco|sam'?s club|whole foods", re.I), "Shopping", "Retail"),
    (re.compile(r"uber eats|doordash|grubhub|instacart|postmates", re.I), "Food & Dining", "Food Delivery"),
    (re.compile(r"mcdonald|starbucks|chick-fil-a|chipotle|subway|pizza|restaurant|cafe|diner|sushi|tacos|burger", re.I), "Food & Dining", "Restaurants"),
    (re.compile(r"uber|lyft|taxi|transit|metro|mta|bart|caltrain|amtrak", re.I), "Transportation", "Transit"),
    (re.compile(r"shell|chevron|bp|exxon|mobil|sunoco|marathon|speedway|gas station", re.I), "Transportation", "Gas & Fuel"),
    (re.compile(r"cvs|walgreens|rite aid|pharmacy|rx|prescription", re.I), "Health", "Pharmacy"),
    (re.compile(r"gym|planet fitness|equinox|crossfit|ymca|lifetime fitness", re.I), "Health", "Fitness"),
    (re.compile(r"rent|lease|apartment|property management", re.I), "Housing", "Rent"),
    (re.compile(r"electric|gas|water|sewer|utility|pg&e|con ed|dominion", re.I), "Bills & Utilities", "Utilities"),
    (re.compile(r"at&t|verizon|t-mobile|sprint|comcast|xfinity|charter|spectrum", re.I), "Bills & Utilities", "Phone & Internet"),
    (re.compile(r"transfer|zelle|venmo|paypal|cash app|wire", re.I), "Transfer", "Transfer"),
    (re.compile(r"paycheck|direct deposit|salary|payroll", re.I), "Income", "Paycheck"),
    (re.compile(r"interest|dividend|refund", re.I), "Income", "Interest & Dividends"),
]


def categorize_by_merchant(merchant_name: str | None, transaction_name: str) -> tuple[str, str]:
    """Returns (category, subcategory) based on merchant name / transaction name."""
    text = f"{merchant_name or ''} {transaction_name}"
    for pattern, category, subcategory in KEYWORD_CATEGORIES:
        if pattern.search(text):
            return category, subcategory
    return "Uncategorized", "Other"


def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # Fetch uncategorized transactions
    cur.execute(
        "SELECT id, name, merchant_name FROM transactions WHERE category IS NULL LIMIT 1000"
    )
    transactions = cur.fetchall()

    if not transactions:
        print(json.dumps({"status": "ok", "categorized": 0, "message": "No uncategorized transactions found."}))
        cur.close()
        conn.close()
        return

    category_counts: dict[str, int] = {}
    categorized = 0

    for txn in transactions:
        category, subcategory = categorize_by_merchant(txn["merchant_name"], txn["name"])

        cur.execute(
            "UPDATE transactions SET category = %s, subcategory = %s WHERE id = %s",
            (category, subcategory, txn["id"])
        )
        category_counts[category] = category_counts.get(category, 0) + 1
        categorized += 1

    conn.commit()
    cur.close()
    conn.close()

    print(json.dumps({
        "status": "ok",
        "categorized": categorized,
        "by_category": category_counts,
        "message": f"Categorized {categorized} transaction(s).",
    }))


if __name__ == "__main__":
    main()
