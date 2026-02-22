CREATE TABLE holdings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  ticker_symbol VARCHAR(20) NOT NULL,
  security_name VARCHAR(255),
  security_type VARCHAR(50),        -- equity, etf, mutual_fund, bond, crypto, option
  quantity DECIMAL(18, 8) NOT NULL,
  cost_basis_per_share DECIMAL(18, 6),
  cost_basis_total DECIMAL(18, 4),
  market_price DECIMAL(18, 6),
  market_value DECIMAL(18, 4),
  unrealized_gain_loss DECIMAL(18, 4),
  unrealized_gain_loss_pct DECIMAL(8, 4),
  acquisition_date DATE,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_holdings_ticker ON holdings(ticker_symbol);
