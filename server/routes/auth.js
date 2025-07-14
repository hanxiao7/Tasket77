const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const moment = require('moment-timezone');
const { JWT_SECRET } = require('../middleware/auth');

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

      // Create default workspace for the user
      const workspaceResult = await client.query(
        'INSERT INTO workspaces (name, description, is_default, user_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $5) RETURNING id',
        [
          'Default Workspace',
          'Default workspace for your tasks',
          true,
          user.id,
          moment().utc().format('YYYY-MM-DD HH:mm:ss')
        ]
      );

      const workspaceId = workspaceResult.rows[0].id;

      // Create default tag for the user
      await client.query(
        'INSERT INTO tags (name, workspace_id, user_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $4)',
        [
          'General',
          workspaceId, // Use the actual workspace ID
          user.id,
          moment().utc().format('YYYY-MM-DD HH:mm:ss')
        ]
      );

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
        sameSite: 'strict',
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
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const client = await pool.connect();
    
    try {
      // Find user by email
      const userResult = await client.query(
        'SELECT id, email, password_hash, name FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const user = userResult.rows[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Generate JWT token
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

      // Delete any existing sessions for this user and create new one
      await client.query(
        'DELETE FROM user_sessions WHERE user_id = $1',
        [user.id]
      );
      
      await client.query(
        'INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES ($1, $2, $3)',
        [user.id, token, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
      );

      // Set cookie
      res.cookie('sessionToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

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
    }

  } catch (error) {
    console.error('Login error:', error);
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
      sameSite: 'strict'
    });

    res.json({ message: 'Logout successful' });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current user info
router.get('/me', async (req, res) => {
  try {
    const token = req.cookies.sessionToken;
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    const client = await pool.connect();
    try {
      const userResult = await client.query(
        'SELECT id, email, name, created_at FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({ error: 'User not found' });
      }

      res.json({ user: userResult.rows[0] });

    } finally {
      client.release();
    }

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

module.exports = router; 