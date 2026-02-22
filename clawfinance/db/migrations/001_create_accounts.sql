-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- All linked financial accounts
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  institution_name VARCHAR(255) NOT NULL,
  account_name VARCHAR(255),
  type VARCHAR(50) NOT NULL,        -- depository, credit, investment, loan, mortgage
  subtype VARCHAR(50),              -- checking, savings, credit_card, 401k, ira, brokerage
  mask VARCHAR(10),                 -- last 4 digits
  balance_current DECIMAL(18, 4),
  balance_available DECIMAL(18, 4),
  balance_limit DECIMAL(18, 4),
  currency_code VARCHAR(3) DEFAULT 'USD',
  api_source VARCHAR(50) NOT NULL,  -- plaid, snaptrade, manual
  external_id VARCHAR(255) UNIQUE,
  access_token_encrypted BYTEA,     -- pgcrypto AES-256 encrypted Plaid token
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
