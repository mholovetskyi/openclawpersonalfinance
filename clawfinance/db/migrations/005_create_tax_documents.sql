CREATE TABLE tax_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  year INTEGER NOT NULL,
  form_type VARCHAR(20) NOT NULL,   -- W2, 1099-INT, 1099-DIV, 1099-B, 1099-MISC, 1040
  issuer_name VARCHAR(255),
  file_path VARCHAR(512),
  extracted_data JSONB NOT NULL DEFAULT '{}',
  total_income DECIMAL(18, 4),
  total_tax_withheld DECIMAL(18, 4),
  date_ingested TIMESTAMPTZ DEFAULT NOW()
);
