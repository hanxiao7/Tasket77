const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/taskmanagement',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  try {
    const token = req.cookies.sessionToken;
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if token is older than 1 day and refresh if needed
    const tokenAge = Date.now() - decoded.iat * 1000;
    const oneDay = 24 * 60 * 60 * 1000; // 1 day in milliseconds
    
    if (tokenAge > oneDay) {
      // Create new token with 7-day expiration
      const newToken = jwt.sign({ userId: decoded.userId }, JWT_SECRET, { expiresIn: '7d' });
      
      // Update session in database
      const client = await pool.connect();
      try {
        await client.query(
          'UPDATE user_sessions SET session_token = $1, expires_at = $2 WHERE user_id = $3',
          [newToken, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), decoded.userId]
        );
      } finally {
        client.release();
      }
      
      // Set new token in cookie
      res.cookie('sessionToken', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
    }
    
    // Add user info to request
    req.user = { userId: decoded.userId };
    next();
    
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

// Optional authentication middleware (for routes that can work with or without auth)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.cookies.sessionToken;
    
    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { userId: decoded.userId };
    next();
    
  } catch (error) {
    // If token is invalid, just continue without user
    req.user = null;
    next();
  }
};

module.exports = {
  authenticateToken,
  optionalAuth,
  JWT_SECRET
}; 