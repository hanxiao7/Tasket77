const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'tasks.db');
console.log('🧹 Cleaning up duplicate workspaces...');

const db = new sqlite3.Database(dbPath);

// First, update all tasks and tags to use workspace ID 1
db.run("UPDATE tasks SET workspace_id = 1 WHERE workspace_id > 1", function(err) {
  if (err) {
    console.error('Error updating tasks:', err.message);
  } else {
    console.log(`✅ Updated ${this.changes} tasks to use workspace ID 1`);
  }
  
  db.run("UPDATE tags SET workspace_id = 1 WHERE workspace_id > 1", function(err) {
    if (err) {
      console.error('Error updating tags:', err.message);
    } else {
      console.log(`✅ Updated ${this.changes} tags to use workspace ID 1`);
    }
    
    // Remove all workspaces except ID 1
    db.run("DELETE FROM workspaces WHERE id > 1", function(err) {
      if (err) {
        console.error('Error removing duplicate workspaces:', err.message);
      } else {
        console.log(`✅ Removed ${this.changes} duplicate workspaces`);
      }
      
      db.close();
      console.log('✅ Cleanup completed!');
    });
  });
}); 