const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create database connection
const dbPath = path.join(__dirname, 'tasks.db');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Check if areas table exists (old structure)
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='areas'", (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        const hasAreasTable = !!row;
        
        if (hasAreasTable) {
          // Migrate from areas to tags
          console.log('Migrating from areas to tags...');
          
          // Create tags table
      db.run(`
            CREATE TABLE IF NOT EXISTS tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

          // Copy data from areas to tags
          db.run("INSERT OR IGNORE INTO tags (id, name, created_at, updated_at) SELECT id, name, created_at, updated_at FROM areas");
          
          // Add tag_id column to tasks if it doesn't exist
          db.run("ALTER TABLE tasks ADD COLUMN tag_id INTEGER");
          
          // Copy area_id to tag_id
          db.run("UPDATE tasks SET tag_id = area_id WHERE area_id IS NOT NULL");
          
          // Drop the old area_id column (SQLite doesn't support DROP COLUMN, so we'll recreate the table)
          db.run(`
            CREATE TABLE tasks_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              title TEXT NOT NULL,
              description TEXT,
              tag_id INTEGER,
              parent_task_id INTEGER,
              status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'paused', 'done')),
              priority TEXT DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
              due_date DATE,
              start_date DATETIME,
              completion_date DATETIME,
              last_modified DATETIME DEFAULT CURRENT_TIMESTAMP,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (tag_id) REFERENCES tags (id),
              FOREIGN KEY (parent_task_id) REFERENCES tasks (id)
            )
          `);
          
          // Copy data to new table
          db.run(`
            INSERT INTO tasks_new (id, title, description, tag_id, parent_task_id, status, priority, due_date, start_date, completion_date, last_modified, created_at)
            SELECT id, title, description, tag_id, parent_task_id, status, priority, due_date, start_date, completion_date, last_modified, created_at FROM tasks
          `);
          
          // Drop old table and rename new one
          db.run("DROP TABLE tasks");
          db.run("ALTER TABLE tasks_new RENAME TO tasks");
          
          // Drop areas table
          db.run("DROP TABLE areas");
          
          console.log('Migration completed successfully');
        } else {
          // Fresh installation - create tags table
          db.run(`
            CREATE TABLE IF NOT EXISTS tags (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL UNIQUE,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `);
        }
        
        // Create tasks table (if it doesn't exist)
      db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
            tag_id INTEGER,
          parent_task_id INTEGER,
          status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'paused', 'done')),
          priority TEXT DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
          due_date DATE,
          start_date DATETIME,
          completion_date DATETIME,
          last_modified DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tag_id) REFERENCES tags (id),
          FOREIGN KEY (parent_task_id) REFERENCES tasks (id)
        )
      `);

      // Task history table for tracking status changes and dates
      db.run(`
        CREATE TABLE IF NOT EXISTS task_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER NOT NULL,
          status TEXT NOT NULL,
          action_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          notes TEXT,
          FOREIGN KEY (task_id) REFERENCES tasks (id)
        )
      `);

        // Insert default tag if none exists
        db.get("SELECT COUNT(*) as count FROM tags", (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (row.count === 0) {
            db.run("INSERT INTO tags (name) VALUES (?)", ['General'], (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        } else {
          resolve();
        }
        });
      });
    });
  });
}

// Helper function to update task's last_modified timestamp
function updateTaskModified(taskId) {
  return new Promise((resolve, reject) => {
    const moment = require('moment-timezone');
    const now = moment().tz('America/New_York').format('YYYY-MM-DD HH:mm:ss');
    db.run(
      "UPDATE tasks SET last_modified = ? WHERE id = ?",
      [now, taskId],
      function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
}

// Helper function to add task history entry
function addTaskHistory(taskId, status, notes = null) {
  return new Promise((resolve, reject) => {
    const moment = require('moment-timezone');
    const now = moment().tz('America/New_York').format('YYYY-MM-DD HH:mm:ss');
    db.run(
      "INSERT INTO task_history (task_id, status, notes, action_date) VALUES (?, ?, ?, ?)",
      [taskId, status, notes, now],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

module.exports = {
  db,
  initializeDatabase,
  updateTaskModified,
  addTaskHistory
}; 