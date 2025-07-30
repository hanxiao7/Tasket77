-- Migration 006: Move is_default column from workspaces to workspace_permissions

-- Step 1: Add is_default column to workspace_permissions table
ALTER TABLE workspace_permissions 
ADD COLUMN is_default BOOLEAN DEFAULT FALSE;

-- Step 2: Migrate existing defaults from workspaces.is_default to workspace_permissions.is_default
UPDATE workspace_permissions 
SET is_default = true
WHERE workspace_id IN (
  SELECT id FROM workspaces WHERE is_default = true
);

-- Step 3: Remove is_default column from workspaces table
ALTER TABLE workspaces 
DROP COLUMN is_default;

-- Create index for performance on the new is_default column
CREATE INDEX idx_workspace_permissions_is_default ON workspace_permissions(is_default); 