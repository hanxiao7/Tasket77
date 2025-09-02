-- Migration: Create new filter system tables
-- File: 009_create_filter_system.sql

-- Create filter_preferences table
CREATE TABLE filter_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  view_mode VARCHAR(20) CHECK (view_mode IN ('planner', 'tracker')) NOT NULL,
  operator VARCHAR(10) CHECK (operator IN ('AND', 'OR')) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, workspace_id, name)
);

-- Create filter_conditions table
CREATE TABLE filter_conditions (
  id SERIAL PRIMARY KEY,
  filter_id INTEGER REFERENCES filter_preferences(id) ON DELETE CASCADE,
  condition_type VARCHAR(20) CHECK (condition_type IN ('list', 'date_diff')) NOT NULL,
  field VARCHAR(50),
  date_from VARCHAR(50),
  date_to VARCHAR(50),
  operator VARCHAR(30) NOT NULL,
  values JSONB DEFAULT '[]',
  unit VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_filter_preferences_user_workspace ON filter_preferences(user_id, workspace_id);
CREATE INDEX idx_filter_preferences_view_mode ON filter_preferences(view_mode);
CREATE INDEX idx_filter_conditions_filter_id ON filter_conditions(filter_id);

-- Insert 9 preset filters using CROSS JOIN
INSERT INTO filter_preferences (user_id, workspace_id, name, view_mode, operator, is_default, created_at)
SELECT 
  wp.user_id,
  wp.workspace_id,
  filter_def.name,
  filter_def.view_mode,
  filter_def.operator,
  filter_def.is_default,
  NOW()
FROM workspace_permissions wp
CROSS JOIN (
  VALUES 
    ('Hide Completed', 'planner', 'AND', true),
    ('Assigned to Me', 'planner', 'AND', false),
    ('Due in 7 Days', 'planner', 'AND', false),
    ('Overdue Tasks', 'planner', 'AND', false),
    ('High/Urgent Priority', 'planner', 'AND', false),
    ('Active in Past 7 Days', 'tracker', 'OR', true),
    ('Unchanged in Past 14 Days', 'tracker', 'AND', false),
    ('Lasted More Than 1 Day', 'tracker', 'AND', false)
) AS filter_def(name, view_mode, operator, is_default);

-- Insert conditions for each filter (using JOIN to avoid CROSS JOIN issue)
INSERT INTO filter_conditions (filter_id, condition_type, field, date_from, date_to, operator, values, unit, created_at)
SELECT 
  fp.id,
  cond_def.condition_type,
  cond_def.field,
  cond_def.date_from,
  cond_def.date_to,
  cond_def.operator,
  cond_def.values::jsonb,
  cond_def.unit,
  NOW()
FROM filter_preferences fp
JOIN (
  VALUES 
    -- Hide Completed
    ('Hide Completed', 'list', 'status', null, null, '!=', '["done"]', null),
    -- Assigned to Me  
    ('Assigned to Me', 'list', 'assignee', null, null, '=', '["current_user_id"]', null),
    -- Due in 7 Days (today to due_date <= 7)
    ('Due in 7 Days', 'date_diff', null, 'today', 'due_date', '<=', '[7]', 'days'),
    -- Overdue Tasks (today to due_date < 0, meaning due_date is in the past)
    ('Overdue Tasks', 'date_diff', null, 'today', 'due_date', '<', '[0]', 'days'),
    ('Overdue Tasks', 'list', 'status', null, null, '!=', '["done"]', null),
    -- High/Urgent Priority
    ('High/Urgent Priority', 'list', 'priority', null, null, 'IN', '["high", "urgent"]', null),
    -- Active in Past 7 Days (today to completion_date <= 7)
    ('Active in Past 7 Days', 'list', 'status', null, null, 'IN', '["in_progress", "paused"]', null),
    ('Active in Past 7 Days', 'date_diff', null, 'completion_date', 'today', '<=', '[7]', 'days'),
    -- Unchanged in Past 14 Days (today to last_modified > 14)
    ('Unchanged in Past 14 Days', 'list', 'status', null, null, '!=', '["done"]', null),
    ('Unchanged in Past 14 Days', 'date_diff', null, 'last_modified', 'today', '>', '[14]', 'days'),
    -- Lasted More Than 1 Day (created_date to completion_date > 1)
    ('Lasted More Than 1 Day', 'date_diff', null, 'start_date', 'completion_date', '>', '[1]', 'days')
) AS cond_def(filter_name, condition_type, field, date_from, date_to, operator, values, unit) ON fp.name = cond_def.filter_name;

-- Add comments
COMMENT ON TABLE filter_preferences IS 'User-defined filter preferences for tasks';
COMMENT ON TABLE filter_conditions IS 'Individual filter conditions that make up a filter';