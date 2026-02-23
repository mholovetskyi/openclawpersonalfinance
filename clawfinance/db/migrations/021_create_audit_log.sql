-- Audit log for compliance-grade traceability of all data access and mutations
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID DEFAULT '00000000-0000-0000-0000-000000000001',
  action VARCHAR(50) NOT NULL, -- create, read, update, delete, export, import, login
  resource_type VARCHAR(50) NOT NULL, -- accounts, transactions, budgets, etc.
  resource_id VARCHAR(255),
  details JSONB,
  ip_address INET,
  request_id VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
