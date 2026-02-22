CREATE TABLE company_intelligence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticker_symbol VARCHAR(20) NOT NULL UNIQUE,
  company_name VARCHAR(255),
  sector VARCHAR(100),
  industry VARCHAR(100),
  market_cap DECIMAL(18, 2),
  news JSONB DEFAULT '[]',
  sec_filings JSONB DEFAULT '[]',
  earnings_transcripts JSONB DEFAULT '[]',
  social_sentiment JSONB DEFAULT '{}',
  alt_data JSONB DEFAULT '{}',
  analyst_ratings JSONB DEFAULT '{}',
  last_updated TIMESTAMPTZ DEFAULT NOW()
);
