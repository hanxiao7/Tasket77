-- Migration 009: Add "Assigned to me" preset filter for Tracker view
-- This adds the missing preset filter that was requested by the user

INSERT INTO user_preferences (user_id, workspace_id, preference_key, preference_value)
SELECT 
  wp.user_id,
  wp.workspace_id,
  'assigned_to_me_tracker',
  '{"enabled": false, "type": "system", "view": "tracker", "logic": {"conditions": [{"field": "assignee", "operator": "equals", "values": ["current_user_id"]}], "logic": "AND"}}'
FROM workspace_permissions wp
WHERE wp.user_id IS NOT NULL
ON CONFLICT (user_id, workspace_id, preference_key) DO NOTHING;

-- Migration 010: Fix preset filter logic
-- This updates the existing presets to use the correct logic structure

-- Update the "active_past_7_days" preset to fix the completion_date logic
UPDATE user_preferences 
SET preference_value = '{"enabled": true, "type": "system", "view": "tracker", "logic": {"conditions": [{"field": "status", "operator": "in", "values": ["in_progress", "paused"]}, {"field": "completion_date", "operator": "equals", "values": ["done"], "date_range": 7}], "logic": "OR"}}'
WHERE preference_key = 'active_past_7_days';

-- Update the "unchanged_past_14_days" preset to ensure proper date format
UPDATE user_preferences 
SET preference_value = '{"enabled": false, "type": "system", "view": "tracker", "logic": {"conditions": [{"field": "status", "operator": "not_equals", "values": ["done"]}, {"field": "updated_at", "operator": "less_than", "values": ["now"], "date_range": 14}], "logic": "AND"}}'
WHERE preference_key = 'unchanged_past_14_days';

-- Update the "due_in_7_days" preset to ensure proper date handling
UPDATE user_preferences 
SET preference_value = '{"enabled": false, "type": "system", "view": "planner", "logic": {"conditions": [{"field": "due_date", "operator": "greater_than", "values": ["now"], "date_range": 7}], "logic": "AND"}}'
WHERE preference_key = 'due_in_7_days';

-- Migration 011: Fix field name from updated_at to last_modified
-- The tasks table uses last_modified instead of updated_at

-- Update the "unchanged_past_14_days" preset to use the correct field name
UPDATE user_preferences 
SET preference_value = '{"enabled": false, "type": "system", "view": "tracker", "logic": {"conditions": [{"field": "status", "operator": "not_equals", "values": ["done"]}, {"field": "last_modified", "operator": "less_than", "values": ["now"], "date_range": 14}], "logic": "AND"}}'
WHERE preference_key = 'unchanged_past_14_days';

