CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount DECIMAL(18, 4) NOT NULL,   -- positive = debit/spend, negative = credit/income
  date DATE NOT NULL,
  authorized_date DATE,
  name VARCHAR(500) NOT NULL,
  merchant_name VARCHAR(255),
  category VARCHAR(100),
  subcategory VARCHAR(100),
  pending BOOLEAN DEFAULT false,
  is_recurring BOOLEAN DEFAULT false,
  notes TEXT,
  api_source VARCHAR(50),
  external_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE INDEX idx_transactions_account ON transactions(account_id);
