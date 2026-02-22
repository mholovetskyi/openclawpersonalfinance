CREATE TABLE agent_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name VARCHAR(50) NOT NULL,
  task_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL,      -- running, success, error
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB
);

CREATE INDEX idx_agent_state_agent ON agent_state(agent_name, started_at DESC);
