-- Cron job execution log for OpenClaw-scheduled tasks
CREATE TABLE IF NOT EXISTS cron_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name VARCHAR(100) NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'running' CHECK (status IN ('running', 'success', 'error')),
  duration_ms INTEGER,
  output JSONB DEFAULT '{}',
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_cron_job_name ON cron_executions(job_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_started ON cron_executions(started_at DESC);
