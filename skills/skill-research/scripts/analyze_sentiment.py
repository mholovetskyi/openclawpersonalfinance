#!/usr/bin/env python3
"""
analyze_sentiment.py

Reads sentiment_snapshots and company_news tables to produce a sentiment
trend report for a given ticker over N days.

Usage:
    python3 analyze_sentiment.py --ticker AAPL [--days 30]

Output: JSON to stdout
"""

import os
import sys
import json
import argparse
from datetime import date, timedelta

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print(json.dumps({"status": "error", "message": "psycopg2 not installed"}))
    sys.exit(1)

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print(json.dumps({"status": "error", "message": "DATABASE_URL not set"}))
    sys.exit(1)


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--ticker", required=True)
    p.add_argument("--days", type=int, default=30)
    return p.parse_args()


def main():
    args = parse_args()
    ticker = args.ticker.upper()
    since = (date.today() - timedelta(days=args.days)).isoformat()

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # Sentiment trend
    cur.execute("""
        SELECT snapshot_date, twitter_sentiment, composite_score,
               tweet_volume, bull_tweets, bear_tweets, article_count
        FROM sentiment_snapshots
        WHERE ticker_symbol = %s AND snapshot_date >= %s
        ORDER BY snapshot_date ASC
    """, (ticker, since))
    snapshots = [dict(r) for r in cur.fetchall()]

    # News summary — top headlines and average sentiment
    cur.execute("""
        SELECT headline, source, published_at, sentiment_score, source_type
        FROM company_news
        WHERE ticker_symbol = %s AND published_at >= %s::timestamptz
        ORDER BY published_at DESC
        LIMIT 20
    """, (ticker, since))
    news = []
    for r in cur.fetchall():
        row = dict(r)
        if row["published_at"]:
            row["published_at"] = row["published_at"].isoformat()
        news.append(row)

    # Sentiment stats
    scores = [s["composite_score"] for s in snapshots if s["composite_score"] is not None]
    avg_score = sum(scores) / len(scores) if scores else None
    trend = None
    if len(scores) >= 2:
        half = len(scores) // 2
        first_half = sum(scores[:half]) / half
        second_half = sum(scores[half:]) / (len(scores) - half)
        trend = "improving" if second_half > first_half + 0.05 else "worsening" if second_half < first_half - 0.05 else "stable"

    cur.close()
    conn.close()

    print(json.dumps({
        "status": "ok",
        "ticker": ticker,
        "days": args.days,
        "sentiment_avg": round(avg_score, 3) if avg_score is not None else None,
        "sentiment_label": (
            "bullish" if (avg_score or 0) > 0.2
            else "bearish" if (avg_score or 0) < -0.2
            else "neutral"
        ),
        "trend": trend,
        "daily_snapshots": snapshots,
        "recent_news": news,
    }))


if __name__ == "__main__":
    main()
