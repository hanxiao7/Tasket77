-- Migration 007: Add task assignee functionality

-- Create task_assignees table for multiple assignees per task
CREATE TABLE IF NOT EXISTS task_assignees (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(task_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX idx_task_assignees_task_id ON task_assignees(task_id);
CREATE INDEX idx_task_assignees_user_id ON task_assignees(user_id);
CREATE INDEX idx_task_assignees_assigned_by ON task_assignees(assigned_by);

-- Populate task_assignees with existing task creators as assignees
-- This ensures all existing tasks have their creators as assignees by default
INSERT INTO task_assignees (task_id, user_id, assigned_by, assigned_at)
SELECT 
  id as task_id,
  user_id,  -- The task creator becomes the assignee
  user_id,  -- The task creator also becomes the "assigned_by" person
  created_at  -- Use task creation date as assignment date
FROM tasks
WHERE NOT EXISTS (
  SELECT 1 FROM task_assignees ta WHERE ta.task_id = tasks.id
); 