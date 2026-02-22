#!/usr/bin/env python3
"""
fetch_company_intel.py

Fetches company news from the ClawFinance API and persists sentiment
snapshots + alt data metrics into the database.

Usage:
    python3 fetch_company_intel.py --ticker AAPL [--days 7]

Reads from:
    - GET /api/research/:ticker (aggregated data already fetched by skill)
    - Environment: DATABASE_URL

Writes to:
    - company_news table
    - sentiment_snapshots table
    - alt_data_metrics table
"""

import os
import sys
import json
import argparse
from datetime import datetime, date, timezone

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor, execute_values
except ImportError:
    print(json.dumps({"status": "error", "message": "psycopg2 not installed. Run: pip install psycopg2-binary"}))
    sys.exit(1)

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print(json.dumps({"status": "error", "message": "DATABASE_URL not set"}))
    sys.exit(1)

API_URL = os.environ.get("API_URL", "http://localhost:3001")


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--ticker", required=True, help="Stock ticker symbol")
    p.add_argument("--days", type=int, default=7, help="Days of news to fetch")
    p.add_argument("--data", type=str, help="JSON payload from skill (stdin alternative)")
    return p.parse_args()


def upsert_sentiment(cur, ticker: str, score: float | None, tweet_vol: int, bull: int, bear: int, article_count: int):
    today = date.today().isoformat()
    cur.execute("""
        INSERT INTO sentiment_snapshots
          (ticker_symbol, snapshot_date, twitter_sentiment, composite_score,
           tweet_volume, bull_tweets, bear_tweets, article_count)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (ticker_symbol, snapshot_date) DO UPDATE SET
          twitter_sentiment = EXCLUDED.twitter_sentiment,
          composite_score = EXCLUDED.composite_score,
          tweet_volume = EXCLUDED.tweet_volume,
          bull_tweets = EXCLUDED.bull_tweets,
          bear_tweets = EXCLUDED.bear_tweets,
          article_count = EXCLUDED.article_count
    """, (ticker, today, score, score, tweet_vol, bull, bear, article_count))


def insert_news_articles(cur, ticker: str, articles: list[dict]):
    if not articles:
        return 0
    rows = []
    for a in articles:
        rows.append((
            ticker,
            a.get("headline", a.get("title", ""))[:500],
            a.get("summary", ""),
            a.get("source", ""),
            a.get("url", ""),
            a.get("datetime") and datetime.fromtimestamp(a["datetime"], tz=timezone.utc),
            a.get("sentiment_score"),
            a.get("source_type", "news"),
        ))
    execute_values(cur, """
        INSERT INTO company_news
          (ticker_symbol, headline, summary, source, url, published_at, sentiment_score, source_type)
        VALUES %s
        ON CONFLICT DO NOTHING
    """, rows)
    return len(rows)


def main():
    args = parse_args()
    ticker = args.ticker.upper()

    # Accept pre-fetched data via --data flag (passed by the skill after MCP calls)
    payload: dict = {}
    if args.data:
        payload = json.loads(args.data)
    elif not sys.stdin.isatty():
        payload = json.load(sys.stdin)

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    articles_inserted = 0
    sentiment_updated = False

    # Persist news articles if provided
    news = payload.get("news", [])
    if news:
        articles_inserted = insert_news_articles(cur, ticker, news)

    # Persist Twitter sentiment if provided
    sentiment_data = payload.get("twitter_sentiment", {})
    if sentiment_data:
        upsert_sentiment(
            cur, ticker,
            score=sentiment_data.get("sentiment_score"),
            tweet_vol=sentiment_data.get("bull_tweets", 0) + sentiment_data.get("bear_tweets", 0),
            bull=sentiment_data.get("bull_tweets", 0),
            bear=sentiment_data.get("bear_tweets", 0),
            article_count=len(news),
        )
        sentiment_updated = True

    # Persist alt data if provided
    alt_data = payload.get("alt_data", {})
    if alt_data.get("google_trends"):
        trend_val = alt_data["google_trends"][-1]["value"] if alt_data["google_trends"] else None
        if trend_val is not None:
            cur.execute("""
                INSERT INTO alt_data_metrics
                  (ticker_symbol, metric_date, metric_type, metric_value, metric_label, metadata)
                VALUES (%s, %s, 'google_trends', %s, %s, %s)
                ON CONFLICT (ticker_symbol, metric_date, metric_type) DO UPDATE SET
                  metric_value = EXCLUDED.metric_value,
                  metric_label = EXCLUDED.metric_label
            """, (ticker, date.today().isoformat(), trend_val, f"Google Trends {trend_val}/100", json.dumps(alt_data["google_trends"][-5:])))

    conn.commit()
    cur.close()
    conn.close()

    print(json.dumps({
        "status": "ok",
        "ticker": ticker,
        "articles_inserted": articles_inserted,
        "sentiment_updated": sentiment_updated,
    }))


if __name__ == "__main__":
    main()
