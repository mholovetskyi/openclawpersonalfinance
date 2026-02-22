CREATE TABLE net_worth_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  date DATE NOT NULL,
  total_assets DECIMAL(18, 4) NOT NULL,
  total_liabilities DECIMAL(18, 4) NOT NULL,
  net_worth DECIMAL(18, 4) NOT NULL,
  breakdown JSONB,
  UNIQUE(user_id, date)
);

CREATE INDEX idx_net_worth_date ON net_worth_snapshots(date DESC);
