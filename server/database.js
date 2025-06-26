const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create database connection
const dbPath = path.join(__dirname, 'tasks.db');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Areas table (categories/subjects)
      db.run(`
        CREATE TABLE IF NOT EXISTS areas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Tasks table
      db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          area_id INTEGER,
          parent_task_id INTEGER,
          status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'paused', 'done')),
          priority TEXT DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
          due_date DATE,
          start_date DATETIME,
          completion_date DATETIME,
          last_modified DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (area_id) REFERENCES areas (id),
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

      // Insert default area if none exists
      db.get("SELECT COUNT(*) as count FROM areas", (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (row.count === 0) {
          db.run("INSERT INTO areas (name) VALUES (?)", ['General'], (err) => {
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
}

// Helper function to update task's last_modified timestamp
function updateTaskModified(taskId) {
  return new Promise((resolve, reject) => {
    db.run(
      "UPDATE tasks SET last_modified = CURRENT_TIMESTAMP WHERE id = ?",
      [taskId],
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
    db.run(
      "INSERT INTO task_history (task_id, status, notes) VALUES (?, ?, ?)",
      [taskId, status, notes],
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