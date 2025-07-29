-- Migration 005: Add workspace sharing functionality

-- Create new workspace_permissions table with email column
CREATE TABLE IF NOT EXISTS workspace_permissions (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  access_level VARCHAR(20) NOT NULL CHECK (access_level IN ('owner', 'edit', 'view')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_workspace_permissions_workspace_id ON workspace_permissions(workspace_id);
CREATE INDEX idx_workspace_permissions_user_id ON workspace_permissions(user_id);
CREATE INDEX idx_workspace_permissions_email ON workspace_permissions(email);
CREATE INDEX idx_workspace_permissions_access_level ON workspace_permissions(access_level);

-- Populate the new table with existing workspace creators as owners
INSERT INTO workspace_permissions (workspace_id, user_id, email, access_level)
SELECT 
  w.id as workspace_id,
  w.user_id,
  u.email,
  'owner' as access_level
FROM workspaces w
INNER JOIN users u ON w.user_id = u.id
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_permissions wp WHERE wp.workspace_id = w.id
);

-- Drop the old workspace_permissions table if it exists (it shouldn't exist yet, but just in case)
-- DROP TABLE IF EXISTS workspace_permissions_old; 