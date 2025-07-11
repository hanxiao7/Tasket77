const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create database connection
const dbPath = path.join(__dirname, 'tasks.db');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create workspaces table first
      db.run(`
        CREATE TABLE IF NOT EXISTS workspaces (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          is_default INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Insert default workspace if none exists (use INSERT OR IGNORE to prevent duplicates)
      const moment = require('moment-timezone');
      const now = moment().tz('America/New_York').format('YYYY-MM-DD HH:mm:ss');
      db.run("INSERT OR IGNORE INTO workspaces (id, name, description, is_default, created_at, updated_at) VALUES (1, ?, ?, ?, ?, ?)", 
        ['Default Workspace', 'Default workspace for existing tasks', 1, now, now], (err) => {
        if (err) {
          reject(err);
        } else {
          // Create tables if they don't exist
          createTables();
        }
      });
      
      function createTables() {
        // Create tags table
        db.run(`
          CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            workspace_id INTEGER NOT NULL DEFAULT 1,
            hidden INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (workspace_id) REFERENCES workspaces (id),
            UNIQUE(name, workspace_id)
          )
        `, (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          // Create tasks table
          db.run(`
            CREATE TABLE IF NOT EXISTS tasks (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              title TEXT NOT NULL,
              description TEXT,
              tag_id INTEGER,
              parent_task_id INTEGER,
              workspace_id INTEGER NOT NULL DEFAULT 1,
              status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'paused', 'done')),
              priority TEXT DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
              due_date DATE,
              start_date DATETIME,
              completion_date DATETIME,
              last_modified DATETIME DEFAULT CURRENT_TIMESTAMP,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (tag_id) REFERENCES tags (id),
              FOREIGN KEY (parent_task_id) REFERENCES tasks (id),
              FOREIGN KEY (workspace_id) REFERENCES workspaces (id)
            )
          `, (err) => {
            if (err) {
              reject(err);
              return;
            }
            
            finalizeSetup();
          });
        });
      }



      function finalizeSetup() {
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
            const moment = require('moment-timezone');
            const now = moment().tz('America/New_York').format('YYYY-MM-DD HH:mm:ss');
            db.run("INSERT INTO tags (name, workspace_id, created_at, updated_at) VALUES (?, ?, ?, ?)", ['General', 1, now, now], (err) => {
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
      }
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