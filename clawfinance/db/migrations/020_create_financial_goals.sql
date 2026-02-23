-- Financial goals for savings, debt payoff, investments, etc.
CREATE TABLE financial_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  name VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL, -- savings, debt_payoff, investment, emergency_fund, custom
  target_amount DECIMAL(18, 4) NOT NULL,
  current_amount DECIMAL(18, 4) NOT NULL DEFAULT 0,
  target_date DATE,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_financial_goals_user ON financial_goals(user_id);
CREATE INDEX idx_financial_goals_active ON financial_goals(is_active) WHERE is_active = true;
