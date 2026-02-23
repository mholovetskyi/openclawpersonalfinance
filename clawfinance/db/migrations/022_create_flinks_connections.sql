-- Flinks connector: stores connection state for linked institutions
CREATE TABLE flinks_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  institution VARCHAR(255) NOT NULL,
  login_id_encrypted TEXT NOT NULL,
  last_request_id VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'active',  -- active, mfa_required, error, disconnected
  last_synced_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, institution)
);

CREATE INDEX idx_flinks_connections_user ON flinks_connections(user_id);
CREATE INDEX idx_flinks_connections_status ON flinks_connections(status);
