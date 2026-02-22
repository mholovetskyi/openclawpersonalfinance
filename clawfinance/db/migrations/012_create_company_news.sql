-- Company news cache (sourced from Finnhub, SEC, Twitter)
CREATE TABLE IF NOT EXISTS company_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker_symbol VARCHAR(20) NOT NULL,
  headline TEXT NOT NULL,
  summary TEXT,
  source VARCHAR(100),
  url TEXT,
  published_at TIMESTAMPTZ,
  sentiment_score NUMERIC(4,3),  -- -1.0 to 1.0
  source_type VARCHAR(20) DEFAULT 'news', -- news | sec | twitter
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_news_ticker ON company_news(ticker_symbol);
CREATE INDEX IF NOT EXISTS idx_company_news_published ON company_news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_news_ticker_published ON company_news(ticker_symbol, published_at DESC);
