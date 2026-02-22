CREATE TABLE deductions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  year INTEGER NOT NULL,
  type VARCHAR(50) NOT NULL, -- charitable, medical, salt, mortgage_interest, student_loan_interest
  amount DECIMAL(18, 4) NOT NULL,
  source VARCHAR(255),       -- transaction_id, tax_document_id, or 'manual'
  status VARCHAR(20) DEFAULT 'estimated', -- confirmed, estimated
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deductions_year ON deductions(year);
