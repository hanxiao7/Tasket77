const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create database connection
const dbPath = path.join(__dirname, 'tasks.db');
const db = new sqlite3.Database(dbPath);

async function fixWorkspaceData() {
  return new Promise((resolve, reject) => {
    console.log('🔧 Fixing workspace data...');
    
    db.serialize(() => {
      // Ensure default workspace exists
      db.get("SELECT COUNT(*) as count FROM workspaces", (err, row) => {
        if (err) {
          console.error('Error checking workspaces:', err);
          reject(err);
          return;
        }
        
        if (row.count === 0) {
          console.log('Creating default workspace...');
          const moment = require('moment-timezone');
          const now = moment().tz('America/New_York').format('YYYY-MM-DD HH:mm:ss');
          db.run("INSERT INTO workspaces (name, description, created_at, updated_at) VALUES (?, ?, ?, ?)", 
            ['Default Workspace', 'Default workspace for existing tasks', now, now], (err) => {
            if (err) {
              console.error('Error creating default workspace:', err);
              reject(err);
            } else {
              console.log('✅ Default workspace created');
              fixTables();
            }
          });
        } else {
          console.log('✅ Default workspace already exists');
          fixTables();
        }
      });
      
      function fixTables() {
        // Fix tags table
        db.all("PRAGMA table_info(tags)", (err, columns) => {
          if (err) {
            console.log('Tags table does not exist, skipping...');
            fixTasksTable();
            return;
          }
          
          const hasWorkspaceId = columns.some(col => col.name === 'workspace_id');
          
          if (!hasWorkspaceId) {
            console.log('Adding workspace_id to tags table...');
            
            // Drop the new table if it exists from a previous run
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
                  
                  console.log('✅ Tags table fixed');
                  fixTasksTable();
                });
              });
            });
          } else {
            console.log('✅ Tags table already has workspace_id');
            fixTasksTable();
          }
        });
      }
      
      function fixTasksTable() {
        // Fix tasks table
        db.all("PRAGMA table_info(tasks)", (err, columns) => {
          if (err) {
            console.log('Tasks table does not exist, skipping...');
            finalize();
            return;
          }
          
          const hasWorkspaceId = columns.some(col => col.name === 'workspace_id');
          
          if (!hasWorkspaceId) {
            console.log('Adding workspace_id to tasks table...');
            
            // Drop the new table if it exists from a previous run
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
                  
                  console.log('✅ Tasks table fixed');
                  finalize();
                });
              });
            });
          } else {
            console.log('✅ Tasks table already has workspace_id');
            finalize();
          }
        });
      }
      
      function finalize() {
        // Ensure all existing tasks and tags are assigned to workspace_id = 1
        db.run("UPDATE tasks SET workspace_id = 1 WHERE workspace_id IS NULL OR workspace_id = 0", (err) => {
          if (err) {
            console.error('Error updating tasks workspace_id:', err);
          } else {
            console.log('✅ Updated tasks workspace_id');
          }
        });
        
        db.run("UPDATE tags SET workspace_id = 1 WHERE workspace_id IS NULL OR workspace_id = 0", (err) => {
          if (err) {
            console.error('Error updating tags workspace_id:', err);
          } else {
            console.log('✅ Updated tags workspace_id');
          }
        });
        
        // Show summary
        db.get("SELECT COUNT(*) as count FROM tasks", (err, row) => {
          if (err) {
            console.error('Error counting tasks:', err);
          } else {
            console.log(`📊 Total tasks: ${row.count}`);
          }
        });
        
        db.get("SELECT COUNT(*) as count FROM tags", (err, row) => {
          if (err) {
            console.error('Error counting tags:', err);
          } else {
            console.log(`📊 Total tags: ${row.count}`);
          }
        });
        
        db.get("SELECT COUNT(*) as count FROM workspaces", (err, row) => {
          if (err) {
            console.error('Error counting workspaces:', err);
          } else {
            console.log(`📊 Total workspaces: ${row.count}`);
          }
        });
        
        console.log('🎉 Workspace data fix completed!');
        resolve();
      }
    });
  });
}

// Run the fix if this script is executed directly
if (require.main === module) {
  fixWorkspaceData()
    .then(() => {
      console.log('✅ All done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = { fixWorkspaceData }; 