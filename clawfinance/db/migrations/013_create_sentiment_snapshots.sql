-- Sentiment snapshots: aggregated Twitter/news sentiment per ticker per day
CREATE TABLE IF NOT EXISTS sentiment_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker_symbol VARCHAR(20) NOT NULL,
  snapshot_date DATE NOT NULL,
  twitter_sentiment NUMERIC(4,3),   -- -1.0 to 1.0
  news_sentiment NUMERIC(4,3),
  composite_score NUMERIC(4,3),     -- weighted average
  tweet_volume INTEGER DEFAULT 0,
  bull_tweets INTEGER DEFAULT 0,
  bear_tweets INTEGER DEFAULT 0,
  article_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (ticker_symbol, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_sentiment_ticker ON sentiment_snapshots(ticker_symbol);
CREATE INDEX IF NOT EXISTS idx_sentiment_date ON sentiment_snapshots(snapshot_date DESC);
