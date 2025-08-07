-- Migration 008: Add user preferences table
-- This table stores user-specific preferences for each workspace
-- Including assignee filters, sort preferences, column visibility, etc.

CREATE TABLE user_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  preference_key VARCHAR(50) NOT NULL,
  preference_value TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, workspace_id, preference_key)
);

-- Add index for better performance on lookups
CREATE INDEX idx_user_preferences_lookup ON user_preferences(user_id, workspace_id, preference_key);

-- Add index for preference key lookups
CREATE INDEX idx_user_preferences_key ON user_preferences(preference_key); 