const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { authenticateToken } = require('../middleware/auth');
const moment = require('moment');
const { sendWorkspaceAccessEmail } = require('../services/emailService');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/taskmanagement'
});

// Helper function to get user access level for a workspace
async function getUserAccessLevel(userId, workspaceId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT access_level FROM workspace_permissions WHERE user_id = $1 AND workspace_id = $2',
      [userId, workspaceId]
    );
    return result.rows[0]?.access_level || null;
  } finally {
    client.release();
  }
}

// Helper function to check if user is owner
async function isOwner(userId, workspaceId) {
  const accessLevel = await getUserAccessLevel(userId, workspaceId);
  return accessLevel === 'owner';
}

// Get all users and their access levels for a workspace
router.get('/workspaces/:workspaceId/permissions', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { workspaceId } = req.params;
    const userId = req.user.userId;

    // Check if user has access to this workspace
    const userAccess = await getUserAccessLevel(userId, workspaceId);
    if (!userAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all permissions for this workspace
    const result = await client.query(`
      SELECT wp.id, wp.email, wp.access_level, wp.created_at,
             u.name as user_name, u.id as user_id
      FROM workspace_permissions wp
      LEFT JOIN users u ON wp.user_id = u.id
      WHERE wp.workspace_id = $1
      ORDER BY wp.created_at DESC
    `, [workspaceId]);

    // Transform the data
    const permissions = result.rows.map(row => ({
      id: row.id,
      email: row.email,
      user_name: row.user_name,
      user_id: row.user_id,
      access_level: row.access_level,
      status: row.user_id ? 'active' : 'pending',
      created_at: row.created_at
    }));

    res.json(permissions);
  } catch (error) {
    console.error('Error fetching workspace permissions:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Add user to workspace
router.post('/workspaces/:workspaceId/permissions', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { workspaceId } = req.params;
    const { email, access_level } = req.body;
    const userId = req.user.userId;
    
    console.log(`🔗 Adding user ${email} to workspace ${workspaceId} with ${access_level} access by user ${userId}`);

    // Validate input
    if (!email || !access_level || !['edit', 'view'].includes(access_level)) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    // Check if user is owner
    if (!(await isOwner(userId, workspaceId))) {
      return res.status(403).json({ error: 'Only owners can add users' });
    }

    // Check if user already has access
    const existingPermission = await client.query(
      'SELECT * FROM workspace_permissions WHERE workspace_id = $1 AND email = $2',
      [workspaceId, email]
    );

    if (existingPermission.rows.length > 0) {
      return res.status(400).json({ error: 'User already has access to this workspace' });
    }

    // Get workspace name for email
    const workspaceResult = await client.query(
      'SELECT name FROM workspaces WHERE id = $1',
      [workspaceId]
    );
    const workspaceName = workspaceResult.rows[0]?.name || 'Unknown Workspace';

    // Check if user exists
    const userResult = await client.query(
      'SELECT id, name FROM users WHERE email = $1',
      [email]
    );

    let user_id = null;
    if (userResult.rows.length > 0) {
      user_id = userResult.rows[0].id;
    }

    // Add permission
    await client.query(
      'INSERT INTO workspace_permissions (workspace_id, user_id, email, access_level) VALUES ($1, $2, $3, $4)',
      [workspaceId, user_id, email, access_level]
    );

    console.log(`✅ Successfully added user ${email} (user_id: ${user_id}) to workspace ${workspaceId}`);

    // Send email
    const emailResult = await sendWorkspaceAccessEmail(email, workspaceName, access_level);
    
    if (!emailResult.success) {
      console.log(`⚠️ Email notification failed: ${emailResult.reason || emailResult.error}`);
    }

    res.json({ 
      success: true, 
      message: user_id ? 'User added successfully' : 'Invitation sent successfully',
      emailSent: emailResult.success
    });

  } catch (error) {
    console.error('Error adding user to workspace:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Update user's access level
router.put('/workspaces/:workspaceId/permissions/:permissionId', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { workspaceId, permissionId } = req.params;
    const { access_level } = req.body;
    const userId = req.user.userId;

    // Validate input
    if (!access_level || !['edit', 'view'].includes(access_level)) {
      return res.status(400).json({ error: 'Invalid access level' });
    }

    // Check if user is owner
    if (!(await isOwner(userId, workspaceId))) {
      return res.status(403).json({ error: 'Only owners can change access levels' });
    }

    // Get the permission to update
    const permissionResult = await client.query(
      'SELECT * FROM workspace_permissions WHERE id = $1 AND workspace_id = $2',
      [permissionId, workspaceId]
    );

    if (permissionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Permission not found' });
    }

    const permission = permissionResult.rows[0];

    // Update access level
    await client.query(
      'UPDATE workspace_permissions SET access_level = $1 WHERE id = $2',
      [access_level, permissionId]
    );

    res.json({ success: true, message: 'Access level updated successfully' });

  } catch (error) {
    console.error('Error updating access level:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Remove user from workspace
router.delete('/workspaces/:workspaceId/permissions/:permissionId', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { workspaceId, permissionId } = req.params;
    const userId = req.user.userId;

    // Check if user is owner
    if (!(await isOwner(userId, workspaceId))) {
      return res.status(403).json({ error: 'Only owners can remove users' });
    }

    // Get the permission to remove
    const permissionResult = await client.query(
      'SELECT * FROM workspace_permissions WHERE id = $1 AND workspace_id = $2',
      [permissionId, workspaceId]
    );

    if (permissionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Permission not found' });
    }

    const permission = permissionResult.rows[0];

    // Prevent removing the only owner
    if (permission.access_level === 'owner') {
      const ownerCount = await client.query(
        'SELECT COUNT(*) FROM workspace_permissions WHERE workspace_id = $1 AND access_level = $2',
        [workspaceId, 'owner']
      );
      if (parseInt(ownerCount.rows[0].count) <= 1) {
        return res.status(400).json({ error: 'Cannot remove the only owner' });
      }
    }

    // Remove permission
    await client.query(
      'DELETE FROM workspace_permissions WHERE id = $1',
      [permissionId]
    );

    // If the removed user was the owner, update workspaces.user_id to point to another owner
    if (permission.access_level === 'owner') {
      const newOwnerResult = await client.query(
        'SELECT user_id FROM workspace_permissions WHERE workspace_id = $1 AND access_level = $2 LIMIT 1',
        [workspaceId, 'owner']
      );
      
      if (newOwnerResult.rows.length > 0) {
        await client.query(
          'UPDATE workspaces SET user_id = $1 WHERE id = $2',
          [newOwnerResult.rows[0].user_id, workspaceId]
        );
      }
    }

    res.json({ success: true, message: 'User removed successfully' });

  } catch (error) {
    console.error('Error removing user from workspace:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Transfer ownership
router.post('/workspaces/:workspaceId/permissions/:permissionId/transfer-ownership', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { workspaceId, permissionId } = req.params;
    const userId = req.user.userId;

    // Check if user is owner
    if (!(await isOwner(userId, workspaceId))) {
      return res.status(403).json({ error: 'Only owners can transfer ownership' });
    }

    // Get the permission to transfer ownership to
    const permissionResult = await client.query(
      'SELECT * FROM workspace_permissions WHERE id = $1 AND workspace_id = $2',
      [permissionId, workspaceId]
    );

    if (permissionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Permission not found' });
    }

    const permission = permissionResult.rows[0];

    // Ensure the target user is active (not pending)
    if (!permission.user_id) {
      return res.status(400).json({ error: 'Cannot transfer ownership to pending user' });
    }

    // Transfer ownership
    await client.query(
      'UPDATE workspace_permissions SET access_level = $1 WHERE id = $2',
      ['owner', permissionId]
    );

    // Change current owner to edit access
    await client.query(
      'UPDATE workspace_permissions SET access_level = $1 WHERE user_id = $2 AND workspace_id = $3',
      ['edit', userId, workspaceId]
    );

    // Update the workspaces table to reflect the new owner
    await client.query(
      'UPDATE workspaces SET user_id = $1 WHERE id = $2',
      [permission.user_id, workspaceId]
    );

    res.json({ success: true, message: 'Ownership transferred successfully' });

  } catch (error) {
    console.error('Error transferring ownership:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Leave workspace
router.post('/workspaces/:workspaceId/leave', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { workspaceId } = req.params;
    const userId = req.user.userId;
    
    console.log(`🚪 User ${userId} attempting to leave workspace ${workspaceId}`);

    // Get user's permission
    const permissionResult = await client.query(
      'SELECT * FROM workspace_permissions WHERE user_id = $1 AND workspace_id = $2',
      [userId, workspaceId]
    );

    if (permissionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Permission not found' });
    }

    const permission = permissionResult.rows[0];

    // Prevent owner from leaving if they're the only owner
    if (permission.access_level === 'owner') {
      const ownerCount = await client.query(
        'SELECT COUNT(*) FROM workspace_permissions WHERE workspace_id = $1 AND access_level = $2',
        [workspaceId, 'owner']
      );
      if (parseInt(ownerCount.rows[0].count) <= 1) {
        return res.status(400).json({ error: 'Cannot leave workspace as the only owner' });
      }
    }

    // Check if this was the user's default workspace BEFORE deleting
    const wasDefault = permission.is_default;
    console.log(`🏠 Workspace ${workspaceId} is_default: ${wasDefault}`);

    // Remove permission
    await client.query(
      'DELETE FROM workspace_permissions WHERE user_id = $1 AND workspace_id = $2',
      [userId, workspaceId]
    );

    // If the leaving user was the owner, update workspaces.user_id to point to another owner
    if (permission.access_level === 'owner') {
      const newOwnerResult = await client.query(
        'SELECT user_id FROM workspace_permissions WHERE workspace_id = $1 AND access_level = $2 LIMIT 1',
        [workspaceId, 'owner']
      );
      
      if (newOwnerResult.rows.length > 0) {
        await client.query(
          'UPDATE workspaces SET user_id = $1 WHERE id = $2',
          [newOwnerResult.rows[0].user_id, workspaceId]
        );
      }
    }

    // Handle default workspace reassignment if this was the user's default
    if (wasDefault) {
      console.log(`⚠️ User ${userId} is leaving their default workspace ${workspaceId}, will reassign default`);
      
      // Find any other accessible workspace to make default (owner, edit, or view access)
      const otherWorkspaceResult = await client.query(
        'SELECT wp.workspace_id FROM workspace_permissions wp WHERE wp.user_id = $1 AND wp.workspace_id != $2 ORDER BY wp.workspace_id LIMIT 1',
        [userId, workspaceId]
      );

      if (otherWorkspaceResult.rows.length > 0) {
        // Set another accessible workspace as default
        await client.query(
          'UPDATE workspace_permissions SET is_default = true WHERE user_id = $1 AND workspace_id = $2',
          [userId, otherWorkspaceResult.rows[0].workspace_id]
        );
        console.log(`✅ Set workspace ${otherWorkspaceResult.rows[0].workspace_id} as new default for user ${userId}`);
      } else {
        // Create a new default workspace if user has no other accessible workspaces
        const newWorkspaceResult = await client.query(
          'INSERT INTO workspaces (name, description, user_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $4) RETURNING id',
          ['My Workspace', 'Default workspace for your tasks', userId, moment().utc().format('YYYY-MM-DD HH:mm:ss')]
        );
        
        // Add owner permission for the new workspace with is_default = true
        const userResult = await client.query(
          'SELECT email FROM users WHERE id = $1',
          [userId]
        );
        
        if (userResult.rows.length > 0) {
          await client.query(
            'INSERT INTO workspace_permissions (workspace_id, user_id, email, access_level, is_default) VALUES ($1, $2, $3, $4, $5)',
            [newWorkspaceResult.rows[0].id, userId, userResult.rows[0].email, 'owner', true]
          );
          console.log(`✅ Created new workspace ${newWorkspaceResult.rows[0].id} as default for user ${userId}`);
        }
      }
    }

    res.json({ success: true, message: 'Left workspace successfully' });

  } catch (error) {
    console.error('Error leaving workspace:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router; 