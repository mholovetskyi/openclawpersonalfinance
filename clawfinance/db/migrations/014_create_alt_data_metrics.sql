-- Alternative data metrics (Google Trends, app rankings, job postings)
CREATE TABLE IF NOT EXISTS alt_data_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker_symbol VARCHAR(20) NOT NULL,
  metric_date DATE NOT NULL,
  metric_type VARCHAR(50) NOT NULL,  -- google_trends | app_ranking | job_postings | web_traffic
  metric_value NUMERIC(12,2),
  metric_label VARCHAR(100),         -- e.g. "App Store rank #3", "Google Trends 85/100"
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (ticker_symbol, metric_date, metric_type)
);

CREATE INDEX IF NOT EXISTS idx_alt_data_ticker ON alt_data_metrics(ticker_symbol);
CREATE INDEX IF NOT EXISTS idx_alt_data_date ON alt_data_metrics(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_alt_data_type ON alt_data_metrics(metric_type);
