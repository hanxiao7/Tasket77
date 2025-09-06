const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const moment = require('moment-timezone');
const { JWT_SECRET } = require('../middleware/auth');
const { createDefaultPresetFilters, createExampleTasks } = require('../services/workspaceInit');

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/taskmanagement',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Helper function to validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({ error: 'Name must be at least 2 characters long' });
    }

    const client = await pool.connect();
    
    try {
      // Check if user already exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'Email already exists' });
      }

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create user
      const userResult = await client.query(
        'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at',
        [email.toLowerCase(), passwordHash, name.trim()]
      );

      const user = userResult.rows[0];

      // Check for pending workspace invitations first
      const pendingPermissions = await client.query(
        'SELECT * FROM workspace_permissions WHERE email = $1 AND user_id IS NULL',
        [user.email]
      );

      console.log(`🔍 Found ${pendingPermissions.rows.length} pending invitations for ${user.email}`);

      // Update pending permissions with user_id
      for (const permission of pendingPermissions.rows) {
        await client.query(
          'UPDATE workspace_permissions SET user_id = $1 WHERE id = $2',
          [user.id, permission.id]
        );
        console.log(`✅ Updated pending permission ${permission.id} with user_id ${user.id}`);
      }

      // Check if user has any accessible workspaces after updating pending invitations
      const accessibleWorkspaces = await client.query(
        'SELECT COUNT(*) as count FROM workspace_permissions WHERE user_id = $1',
        [user.id]
      );

      console.log(`🔍 User ${user.email} has ${accessibleWorkspaces.rows[0].count} accessible workspaces`);
      console.log(`🔍 Count type: ${typeof accessibleWorkspaces.rows[0].count}, value: "${accessibleWorkspaces.rows[0].count}"`);

      if (parseInt(accessibleWorkspaces.rows[0].count) === 0) {
        // No accessible workspaces, create a default workspace
        console.log(`📝 Creating default workspace for new user ${user.email} (no pending invitations)`);
        
        const workspaceResult = await client.query(
          'INSERT INTO workspaces (name, description, user_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $4) RETURNING id',
          [
            'Default Workspace',
            'Default workspace for your tasks',
            user.id,
            moment().utc().format('YYYY-MM-DD HH:mm:ss')
          ]
        );

        // Add owner permission for the default workspace with is_default = true
        await client.query(
          'INSERT INTO workspace_permissions (workspace_id, user_id, email, access_level, is_default) VALUES ($1, $2, $3, $4, $5)',
          [workspaceResult.rows[0].id, user.id, user.email, 'owner', true]
        );

        // Create default preset filters for the new user
        await createDefaultPresetFilters(client, user.id, workspaceResult.rows[0].id);
        
        // Create example tasks for the new user's default workspace
        await createExampleTasks(client, user.id, workspaceResult.rows[0].id);
      } else {
        // User has accessible workspaces from pending invitations
        console.log(`📝 User ${user.email} has ${accessibleWorkspaces.rows[0].count} accessible workspaces from pending invitations`);
        
        // Get all workspaces the user has access to
        const userWorkspaces = await client.query(
          'SELECT workspace_id FROM workspace_permissions WHERE user_id = $1',
          [user.id]
        );
        
        // Create default preset filters for each workspace the user has access to
        for (const workspace of userWorkspaces.rows) {
          await createDefaultPresetFilters(client, user.id, workspace.workspace_id);
        }
        
        // Set the first accessible workspace as default
        const firstWorkspace = await client.query(
          'SELECT workspace_id FROM workspace_permissions WHERE user_id = $1 ORDER BY workspace_id LIMIT 1',
          [user.id]
        );
        
        if (firstWorkspace.rows.length > 0) {
          await client.query(
            'UPDATE workspace_permissions SET is_default = true WHERE user_id = $1 AND workspace_id = $2',
            [user.id, firstWorkspace.rows[0].workspace_id]
          );
          console.log(`✅ Set workspace ${firstWorkspace.rows[0].workspace_id} as default for user ${user.email}`);
        }
      }


      // Generate JWT token
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

      // Create session in database
      await client.query(
        'INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES ($1, $2, $3)',
        [user.id, token, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
      );

      // Set cookie
      res.cookie('sessionToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        message: 'User registered successfully'
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  console.log('🔐 /auth/login endpoint called');
  console.log('📱 Request info:', {
    userAgent: req.get('User-Agent'),
    referer: req.get('Referer'),
    timestamp: new Date().toISOString(),
    existingCookie: !!req.cookies.sessionToken
  });
  const startTime = Date.now();
  
  try {
    const { email, password } = req.body;
    console.log('📧 Login attempt for email:', email);

    // Check for existing session
    if (req.cookies.sessionToken) {
      console.log('⚠️ User already has a session cookie - possible multi-tab login');
    }

    // Validation
    if (!email || !password) {
      console.log('❌ Missing email or password');
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const client = await pool.connect();
    console.log('🗄️ Database connected for login');
    
    try {
      // Find user by email
      console.log('🔍 Looking up user in database...');
      const userResult = await client.query(
        'SELECT id, email, password_hash, name FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (userResult.rows.length === 0) {
        console.log('❌ User not found in database');
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const user = userResult.rows[0];
      console.log('✅ User found:', user.id);

      // Check for existing sessions for this user
      console.log('🔍 Checking for existing sessions...');
      const existingSessions = await client.query(
        'SELECT COUNT(*) as count FROM user_sessions WHERE user_id = $1',
        [user.id]
      );
      console.log(`📊 Found ${existingSessions.rows[0].count} existing sessions for user`);

      // Verify password
      console.log('🔑 Verifying password...');
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        console.log('❌ Invalid password');
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      console.log('✅ Password verified');

      // Generate JWT token
      console.log('🎫 Generating JWT token...');
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

      // Delete any existing sessions for this user and create new one
      console.log('🗑️ Cleaning up old sessions...');
      const deleteResult = await client.query(
        'DELETE FROM user_sessions WHERE user_id = $1',
        [user.id]
      );
      console.log(`🗑️ Deleted ${deleteResult.rowCount} old sessions`);
      
      console.log('💾 Creating new session...');
      await client.query(
        'INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES ($1, $2, $3)',
        [user.id, token, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
      );

      // Set cookie
      console.log('🍪 Setting session cookie...');
      res.cookie('sessionToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      const totalTime = Date.now() - startTime;
      console.log(`✅ Login completed successfully in ${totalTime}ms`);
      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        message: 'Login successful'
      });

    } finally {
      client.release();
      console.log('🗄️ Database connection released');
    }

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`💥 Login error after ${totalTime}ms:`, error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout user
router.post('/logout', async (req, res) => {
  try {
    const token = req.cookies.sessionToken;
    
    if (token) {
      const client = await pool.connect();
      try {
        // Remove session from database
        await client.query(
          'DELETE FROM user_sessions WHERE session_token = $1',
          [token]
        );
      } finally {
        client.release();
      }
    }

    // Clear cookie
    res.clearCookie('sessionToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
    });

    res.json({ message: 'Logout successful' });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current user info
router.get('/me', async (req, res) => {
  console.log('🔍 /auth/me endpoint called');
  console.log('📱 Request info:', {
    userAgent: req.get('User-Agent'),
    referer: req.get('Referer'),
    timestamp: new Date().toISOString()
  });
  const startTime = Date.now();
  
  try {
    const token = req.cookies.sessionToken;
    console.log('🍪 Token present:', !!token);
    
    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('🔑 Token verified for user:', decoded.userId);
    
    const client = await pool.connect();
    console.log('🗄️ Database connected');
    
    try {
      // Check if session exists in database
      console.log('🔍 Checking if session exists in database...');
      const sessionResult = await client.query(
        'SELECT COUNT(*) as count FROM user_sessions WHERE session_token = $1',
        [token]
      );
      console.log(`📊 Session found in database: ${parseInt(sessionResult.rows[0].count) > 0}`);
      
      if (parseInt(sessionResult.rows[0].count) === 0) {
        console.log('⚠️ Token valid but session not found in database - possible session conflict');
      }

      const userResult = await client.query(
        'SELECT id, email, name, created_at FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (userResult.rows.length === 0) {
        console.log('❌ User not found in database');
        return res.status(401).json({ error: 'User not found' });
      }

      const endTime = Date.now();
      console.log(`✅ /auth/me completed in ${endTime - startTime}ms`);
      res.json({ user: userResult.rows[0] });

    } finally {
      client.release();
      console.log('🗄️ Database connection released');
    }

  } catch (error) {
    const endTime = Date.now();
    console.error(`💥 /auth/me error after ${endTime - startTime}ms:`, error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

module.exports = router; 