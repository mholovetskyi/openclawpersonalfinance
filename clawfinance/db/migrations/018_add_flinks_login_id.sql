-- Add Flinks login ID column to accounts table.
-- Flinks uses a LoginId to represent a saved bank connection for subsequent refreshes.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS flinks_login_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_accounts_flinks_login ON accounts(flinks_login_id)
  WHERE flinks_login_id IS NOT NULL;
