CREATE TABLE insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  agent VARCHAR(50) NOT NULL,
  type VARCHAR(80) NOT NULL,
  severity VARCHAR(20) DEFAULT 'info',  -- info, warning, critical, opportunity
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  data JSONB,
  status VARCHAR(20) DEFAULT 'new',    -- new, viewed, dismissed, acted_on
  created_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ
);

CREATE INDEX idx_insights_status ON insights(status);
CREATE INDEX idx_insights_type ON insights(type);
CREATE INDEX idx_insights_created ON insights(created_at DESC);
