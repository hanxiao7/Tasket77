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
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Insert default workspace if none exists
      db.get("SELECT COUNT(*) as count FROM workspaces", (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (row.count === 0) {
          const moment = require('moment-timezone');
          const now = moment().tz('America/New_York').format('YYYY-MM-DD HH:mm:ss');
          db.run("INSERT INTO workspaces (name, description, created_at, updated_at) VALUES (?, ?, ?, ?)", 
            ['Default Workspace', 'Default workspace for existing tasks', now, now], (err) => {
            if (err) {
              reject(err);
            } else {
              // Continue with migration after creating default workspace
              performMigration();
            }
          });
        } else {
          // Default workspace exists, perform migration
          performMigration();
        }
      });

      function performMigration() {
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
                name TEXT NOT NULL,
                workspace_id INTEGER NOT NULL DEFAULT 1,
                hidden INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (workspace_id) REFERENCES workspaces (id),
                UNIQUE(name, workspace_id)
              )
            `);

            // Copy data from areas to tags (assign to default workspace)
            db.run("INSERT OR IGNORE INTO tags (id, name, workspace_id, hidden, created_at, updated_at) SELECT id, name, 1, 0, created_at, updated_at FROM areas");
            
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
            `);
            
            // Copy data to new table
            db.run(`
              INSERT INTO tasks_new (id, title, description, tag_id, parent_task_id, workspace_id, status, priority, due_date, start_date, completion_date, last_modified, created_at)
              SELECT id, title, description, tag_id, parent_task_id, 1, status, priority, due_date, start_date, completion_date, last_modified, created_at FROM tasks
            `);
            
            // Drop old table and rename new one
            db.run("DROP TABLE tasks");
            db.run("ALTER TABLE tasks_new RENAME TO tasks");
            
            // Drop areas table
            db.run("DROP TABLE areas");
            
            console.log('Migration completed successfully');
            finalizeSetup();
          } else {
            // No areas table, check if we need to migrate existing data
            migrateExistingData();
          }
        });
      }

      function migrateExistingData() {
        // Check if tags table exists and needs workspace_id
        db.get("PRAGMA table_info(tags)", (err, rows) => {
          if (err) {
            // Tags table doesn't exist, create it
            createTagsTable();
            return;
          }
          
          // Check if workspace_id column exists
          db.all("PRAGMA table_info(tags)", (err, columns) => {
            if (err) {
              reject(err);
              return;
            }
            
            const hasWorkspaceId = columns.some(col => col.name === 'workspace_id');
            
            if (!hasWorkspaceId) {
              // Need to add workspace_id to existing tags table
              console.log('Adding workspace_id to existing tags table...');
              
              // Drop any existing new table from previous runs
              db.run("DROP TABLE IF EXISTS tags_new");
              
              // Create new tags table with workspace_id
              db.run(`
                CREATE TABLE tags_new (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  name TEXT NOT NULL,
                  workspace_id INTEGER NOT NULL DEFAULT 1,
                  hidden INTEGER DEFAULT 0,
                  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (workspace_id) REFERENCES workspaces (id),
                  UNIQUE(name, workspace_id)
                )
              `);
              
              // Copy existing tags to new table with workspace_id = 1
              db.run(`
                INSERT INTO tags_new (id, name, workspace_id, hidden, created_at, updated_at)
                SELECT id, name, 1, hidden, created_at, updated_at FROM tags
              `, (err) => {
                if (err) {
                  console.error('Error copying tags:', err);
                  reject(err);
                  return;
                }
                
                // Drop old table and rename new one
                db.run("DROP TABLE tags", (err) => {
                  if (err) {
                    console.error('Error dropping old tags table:', err);
                    reject(err);
                    return;
                  }
                  
                  db.run("ALTER TABLE tags_new RENAME TO tags", (err) => {
                    if (err) {
                      console.error('Error renaming tags table:', err);
                      reject(err);
                      return;
                    }
                    
                    console.log('Tags table migrated successfully');
                    checkTasksTable();
                  });
                });
              });
            } else {
              console.log('Tags table already has workspace_id');
              checkTasksTable();
            }
          });
        });
        
        function checkTasksTable() {
          // Check if tasks table needs workspace_id
          db.all("PRAGMA table_info(tasks)", (err, columns) => {
            if (err) {
              // Tasks table doesn't exist, create it
              createTasksTable();
              return;
            }
            
            const hasWorkspaceId = columns.some(col => col.name === 'workspace_id');
            
            if (!hasWorkspaceId) {
              // Need to add workspace_id to existing tasks table
              console.log('Adding workspace_id to existing tasks table...');
              
              // Drop any existing new table from previous runs
              db.run("DROP TABLE IF EXISTS tasks_new");
              
              // Create new tasks table with workspace_id
              db.run(`
                CREATE TABLE tasks_new (
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
              `);
              
              // Copy existing tasks to new table with workspace_id = 1
              db.run(`
                INSERT INTO tasks_new (id, title, description, tag_id, parent_task_id, workspace_id, status, priority, due_date, start_date, completion_date, last_modified, created_at)
                SELECT id, title, description, tag_id, parent_task_id, 1, status, priority, due_date, start_date, completion_date, last_modified, created_at FROM tasks
              `, (err) => {
                if (err) {
                  console.error('Error copying tasks:', err);
                  reject(err);
                  return;
                }
                
                // Drop old table and rename new one
                db.run("DROP TABLE tasks", (err) => {
                  if (err) {
                    console.error('Error dropping old tasks table:', err);
                    reject(err);
                    return;
                  }
                  
                  db.run("ALTER TABLE tasks_new RENAME TO tasks", (err) => {
                    if (err) {
                      console.error('Error renaming tasks table:', err);
                      reject(err);
                      return;
                    }
                    
                    console.log('Tasks table migrated successfully');
                    finalizeSetup();
                  });
                });
              });
            } else {
              console.log('Tasks table already has workspace_id');
              finalizeSetup();
            }
          });
        }
      }

      function createTagsTable() {
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
        `);
        createTasksTable();
      }

      function createTasksTable() {
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
        `);
        finalizeSetup();
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