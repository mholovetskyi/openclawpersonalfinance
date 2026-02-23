-- User preferences for customization & personalization
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  locale VARCHAR(10) NOT NULL DEFAULT 'en-US',
  date_format VARCHAR(20) NOT NULL DEFAULT 'YYYY-MM-DD',
  theme VARCHAR(10) NOT NULL DEFAULT 'dark',
  default_date_range_days INTEGER NOT NULL DEFAULT 30,
  dashboard_layout VARCHAR(20) NOT NULL DEFAULT 'default',
  notification_email VARCHAR(255),
  notification_budget_alerts BOOLEAN NOT NULL DEFAULT true,
  notification_insight_alerts BOOLEAN NOT NULL DEFAULT true,
  notification_goal_alerts BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

-- Seed default preferences
INSERT INTO user_preferences (user_id) VALUES ('00000000-0000-0000-0000-000000000001');
