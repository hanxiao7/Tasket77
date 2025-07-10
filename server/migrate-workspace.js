const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'tasks.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Starting workspace migration...');

// First, clean up any leftover temporary tables
db.serialize(() => {
  console.log('🧹 Cleaning up temporary tables...');
  db.run("DROP TABLE IF EXISTS tags_new");
  db.run("DROP TABLE IF EXISTS tasks_new");
  
  // Ensure default workspace exists
  db.get("SELECT COUNT(*) as count FROM workspaces", (err, row) => {
    if (err) {
      console.error('Error checking workspaces:', err);
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
        } else {
          console.log('✅ Default workspace created');
          migrateTags();
        }
      });
    } else {
      console.log('✅ Default workspace exists');
      migrateTags();
    }
  });
  
  function migrateTags() {
    console.log('📋 Checking tags table...');
    db.all("PRAGMA table_info(tags)", (err, columns) => {
      if (err) {
        console.log('Tags table does not exist, skipping...');
        migrateTasks();
        return;
      }
      
      const hasWorkspaceId = columns.some(col => col.name === 'workspace_id');
      
      if (!hasWorkspaceId) {
        console.log('🔄 Migrating tags table...');
        
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
        `, (err) => {
          if (err) {
            console.error('Error creating new tags table:', err);
            return;
          }
          
          console.log('✅ New tags table created');
          
          // Copy existing tags to new table with workspace_id = 1
          db.run(`
            INSERT INTO tags_new (id, name, workspace_id, hidden, created_at, updated_at)
            SELECT id, name, 1, hidden, created_at, updated_at FROM tags
          `, (err) => {
            if (err) {
              console.error('Error copying tags:', err);
              return;
            }
            
            console.log('✅ Tags copied to new table');
            
            // Drop old table and rename new one
            db.run("DROP TABLE tags", (err) => {
              if (err) {
                console.error('Error dropping old tags table:', err);
                return;
              }
              
              db.run("ALTER TABLE tags_new RENAME TO tags", (err) => {
                if (err) {
                  console.error('Error renaming tags table:', err);
                  return;
                }
                
                console.log('✅ Tags table migration completed');
                migrateTasks();
              });
            });
          });
        });
      } else {
        console.log('✅ Tags table already has workspace_id');
        migrateTasks();
      }
    });
  }
  
  function migrateTasks() {
    console.log('📋 Checking tasks table...');
    db.all("PRAGMA table_info(tasks)", (err, columns) => {
      if (err) {
        console.log('Tasks table does not exist, skipping...');
        finalize();
        return;
      }
      
      const hasWorkspaceId = columns.some(col => col.name === 'workspace_id');
      
      if (!hasWorkspaceId) {
        console.log('🔄 Migrating tasks table...');
        
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
        `, (err) => {
          if (err) {
            console.error('Error creating new tasks table:', err);
            return;
          }
          
          console.log('✅ New tasks table created');
          
          // Copy existing tasks to new table with workspace_id = 1
          db.run(`
            INSERT INTO tasks_new (id, title, description, tag_id, parent_task_id, workspace_id, status, priority, due_date, start_date, completion_date, last_modified, created_at)
            SELECT id, title, description, tag_id, parent_task_id, 1, status, priority, due_date, start_date, completion_date, last_modified, created_at FROM tasks
          `, (err) => {
            if (err) {
              console.error('Error copying tasks:', err);
              return;
            }
            
            console.log('✅ Tasks copied to new table');
            
            // Drop old table and rename new one
            db.run("DROP TABLE tasks", (err) => {
              if (err) {
                console.error('Error dropping old tasks table:', err);
                return;
              }
              
              db.run("ALTER TABLE tasks_new RENAME TO tasks", (err) => {
                if (err) {
                  console.error('Error renaming tasks table:', err);
                  return;
                }
                
                console.log('✅ Tasks table migration completed');
                finalize();
              });
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
    console.log('🎉 Migration completed!');
    
    // Show summary
    db.get("SELECT COUNT(*) as count FROM workspaces", (err, row) => {
      if (!err) console.log(`📊 Workspaces: ${row.count}`);
    });
    
    db.get("SELECT COUNT(*) as count FROM tags", (err, row) => {
      if (!err) console.log(`📊 Tags: ${row.count}`);
    });
    
    db.get("SELECT COUNT(*) as count FROM tasks", (err, row) => {
      if (!err) console.log(`📊 Tasks: ${row.count}`);
    });
    
    db.get("SELECT COUNT(*) as count FROM tags WHERE workspace_id = 1", (err, row) => {
      if (!err) console.log(`📊 Tags in workspace 1: ${row.count}`);
    });
    
    db.get("SELECT COUNT(*) as count FROM tasks WHERE workspace_id = 1", (err, row) => {
      if (!err) console.log(`📊 Tasks in workspace 1: ${row.count}`);
    });
    
    setTimeout(() => {
      db.close();
      console.log('✅ Database closed');
    }, 1000);
  }
}); 