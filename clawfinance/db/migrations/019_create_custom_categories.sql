-- Custom transaction categories with auto-categorization rules
CREATE TABLE custom_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#6b7280',
  icon VARCHAR(50),
  parent_category VARCHAR(100),
  match_patterns TEXT[], -- regex patterns to auto-categorize by merchant name
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, name)
);

CREATE INDEX idx_custom_categories_user ON custom_categories(user_id);
