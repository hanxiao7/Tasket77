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


INSERT INTO user_preferences (user_id, workspace_id, preference_key, preference_value)
SELECT 
  wp.user_id,
  wp.workspace_id,
  preset_key,
  preset_value
FROM workspace_permissions wp
CROSS JOIN (
  VALUES 
    -- Planner view presets
    ('hide_completed', '{"enabled": true, "type": "system", "view": "planner", "logic": {"conditions": [{"field": "status", "operator": "not_equals", "values": ["done"]}], "logic": "AND"}}'),
    ('assigned_to_me', '{"enabled": false, "type": "system", "view": "planner", "logic": {"conditions": [{"field": "assignee", "operator": "equals", "values": ["current_user_id"]}], "logic": "AND"}}'),
    ('due_in_7_days', '{"enabled": false, "type": "system", "view": "planner", "logic": {"conditions": [{"field": "due_date", "operator": "greater_than", "values": ["now"], "date_range": 7}], "logic": "AND"}}'),
    ('overdue_tasks', '{"enabled": false, "type": "system", "view": "planner", "logic": {"conditions": [{"field": "due_date", "operator": "less_than", "values": ["today"]}, {"field": "status", "operator": "not_equals", "values": ["done"]}], "logic": "AND"}}'),
    ('high_urgent_priority', '{"enabled": false, "type": "system", "view": "planner", "logic": {"conditions": [{"field": "priority", "operator": "in", "values": ["high", "urgent"]}], "logic": "AND"}}'),

    -- Tracker view presets
    ('active_past_7_days', '{"enabled": true, "type": "system", "view": "tracker", "logic": {"conditions": [{"field": "status", "operator": "in", "values": ["in_progress", "paused"]}, {"field": "completion_date", "operator": "equals", "values": ["done"], "date_range": 7}], "logic": "OR"}}'),
    ('unchanged_past_14_days', '{"enabled": false, "type": "system", "view": "tracker", "logic": {"conditions": [{"field": "status", "operator": "not_equals", "values": ["done"]}, {"field": "last_modified", "operator": "less_than", "values": ["now"], "date_range": 14}], "logic": "AND"}}'),
    ('lasted_more_than_1_day', '{"enabled": false, "type": "system", "view": "tracker", "logic": {"conditions": [{"field": "status", "operator": "equals", "values": ["done"]}, {"field": "completion_date", "operator": "is_not_null", "values": []}, {"field": "start_date", "operator": "is_not_null", "values": []}, {"field": "duration", "operator": "greater_than", "values": [1], "date_field": "days"}], "logic": "AND"}}'),
    ('assigned_to_me_tracker', '{"enabled": false, "type": "system", "view": "tracker", "logic": {"conditions": [{"field": "assignee", "operator": "equals", "values": ["current_user_id"]}], "logic": "AND"}}')
) AS presets(preset_key, preset_value)
WHERE wp.user_id IS NOT NULL
ON CONFLICT (user_id, workspace_id, preference_key) DO UPDATE
  SET preference_value = EXCLUDED.preference_value,
      updated_at = NOW();

-- 3) Helpful indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_user_preferences_lookup 
  ON user_preferences(user_id, workspace_id, preference_key);
CREATE INDEX IF NOT EXISTS idx_user_preferences_key 
  ON user_preferences(preference_key);