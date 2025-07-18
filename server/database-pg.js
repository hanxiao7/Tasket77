const { Pool } = require('pg');
const moment = require('moment-timezone');

// Create database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/taskmanagement',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Configure type parsers to return DATE fields as strings
const { types } = require('pg');
types.setTypeParser(types.builtins.DATE, (val) => {
  return val; // Return as string (YYYY-MM-DD)
});

// Test the pool connection
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Initialize database tables
async function initializeDatabase() {
  try {
    console.log('Initializing PostgreSQL database...');
    
    // Test connection
    console.log('Testing database connection...');
    const client = await pool.connect();
    console.log('Database connection successful');
    
    // Check if default workspace exists
    // (Removed: No longer create a default workspace)
    
    // Check if default tag exists
    // (Removed: No longer create a default tag)
    
    client.release();
    console.log('PostgreSQL database initialized successfully');
    
  } catch (err) {
    console.error('PostgreSQL database initialization failed:', err);
    throw err;
  }
}

// Helper function to update task's last_modified timestamp
async function updateTaskModified(taskId) {
  const client = await pool.connect();
  try {
    const now = moment().utc().format('YYYY-MM-DD HH:mm:ss');
    const result = await client.query(
      "UPDATE tasks SET last_modified = $1 WHERE id = $2 RETURNING id",
      [now, taskId]
    );
    return result.rowCount;
  } finally {
    client.release();
  }
}

// Helper function to add task history entry
async function addTaskHistory(taskId, status, notes = null) {
  const client = await pool.connect();
  try {
    const now = moment().utc().format('YYYY-MM-DD HH:mm:ss');
    const result = await client.query(
      "INSERT INTO task_history (task_id, status, notes, action_date) VALUES ($1, $2, $3, $4) RETURNING id",
      [taskId, status, notes, now]
    );
    return result.rows[0].id;
  } finally {
    client.release();
  }
}

// Export pool for direct queries
module.exports = {
  pool,
  initializeDatabase,
  updateTaskModified,
  addTaskHistory
}; 