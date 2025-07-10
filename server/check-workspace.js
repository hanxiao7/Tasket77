const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'tasks.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Checking workspace data...\n');

// Check workspaces
db.get("SELECT COUNT(*) as count FROM workspaces", (err, row) => {
  if (err) {
    console.error('Error checking workspaces:', err);
  } else {
    console.log(`📊 Workspaces: ${row.count}`);
  }
});

// Check tags
db.get("SELECT COUNT(*) as count FROM tags", (err, row) => {
  if (err) {
    console.error('Error checking tags:', err);
  } else {
    console.log(`📊 Tags: ${row.count}`);
  }
});

// Check tasks
db.get("SELECT COUNT(*) as count FROM tasks", (err, row) => {
  if (err) {
    console.error('Error checking tasks:', err);
  } else {
    console.log(`📊 Tasks: ${row.count}`);
  }
});

// Check if tags have workspace_id
db.all("PRAGMA table_info(tags)", (err, columns) => {
  if (err) {
    console.log('❌ Tags table does not exist');
  } else {
    const hasWorkspaceId = columns.some(col => col.name === 'workspace_id');
    console.log(`📊 Tags table has workspace_id: ${hasWorkspaceId ? '✅' : '❌'}`);
  }
});

// Check if tasks have workspace_id
db.all("PRAGMA table_info(tasks)", (err, columns) => {
  if (err) {
    console.log('❌ Tasks table does not exist');
  } else {
    const hasWorkspaceId = columns.some(col => col.name === 'workspace_id');
    console.log(`📊 Tasks table has workspace_id: ${hasWorkspaceId ? '✅' : '❌'}`);
  }
});

// Check workspace assignments
db.get("SELECT COUNT(*) as count FROM tags WHERE workspace_id = 1", (err, row) => {
  if (err) {
    console.log('❌ Could not check tag workspace assignments');
  } else {
    console.log(`📊 Tags assigned to workspace 1: ${row.count}`);
  }
});

db.get("SELECT COUNT(*) as count FROM tasks WHERE workspace_id = 1", (err, row) => {
  if (err) {
    console.log('❌ Could not check task workspace assignments');
  } else {
    console.log(`📊 Tasks assigned to workspace 1: ${row.count}`);
  }
});

// Show sample data
console.log('\n📋 Sample data:');
db.all("SELECT id, name, workspace_id FROM workspaces LIMIT 5", (err, rows) => {
  if (err) {
    console.error('Error getting workspaces:', err);
  } else {
    console.log('Workspaces:', rows);
  }
});

db.all("SELECT id, name, workspace_id FROM tags LIMIT 5", (err, rows) => {
  if (err) {
    console.error('Error getting tags:', err);
  } else {
    console.log('Tags:', rows);
  }
});

db.all("SELECT id, title, workspace_id FROM tasks LIMIT 5", (err, rows) => {
  if (err) {
    console.error('Error getting tasks:', err);
  } else {
    console.log('Tasks:', rows);
  }
  
  // Close database after all queries
  setTimeout(() => {
    db.close();
    console.log('\n✅ Database check completed');
  }, 1000);
}); 