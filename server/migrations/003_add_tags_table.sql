-- Migration: Add tags table
-- This migration creates a new tags table and adds tag_id to tasks table

-- Create tags table
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for workspace_id
CREATE INDEX idx_tags_workspace_id ON tags(workspace_id);

-- Create unique constraint for name within workspace
ALTER TABLE tags ADD CONSTRAINT tags_name_workspace_id_key UNIQUE(name, workspace_id);

-- Add tag_id column to tasks table
ALTER TABLE tasks ADD COLUMN tag_id INTEGER REFERENCES tags(id) ON DELETE SET NULL;

-- Create index for tag_id
CREATE INDEX idx_tasks_tag_id ON tasks(tag_id); 