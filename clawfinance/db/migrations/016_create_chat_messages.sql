-- Chat messages between user and ClawFinance agents
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  agent VARCHAR(50),          -- which skill/agent responded (e.g. skill-budget)
  metadata JSONB DEFAULT '{}', -- tool calls, citations, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at DESC);
