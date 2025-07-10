const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'tasks.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Detailed Database Check\n');

// Check table structure
console.log('📋 TABLE STRUCTURES:');
console.log('====================');

// Check workspaces table
db.all("PRAGMA table_info(workspaces)", (err, columns) => {
  if (err) {
    console.log('❌ Workspaces table does not exist');
  } else {
    console.log('\n🏢 WORKSPACES table columns:');
    columns.forEach(col => {
      console.log(`  - ${col.name} (${col.type})`);
    });
  }
});

// Check tags table
db.all("PRAGMA table_info(tags)", (err, columns) => {
  if (err) {
    console.log('❌ Tags table does not exist');
  } else {
    console.log('\n🏷️ TAGS table columns:');
    columns.forEach(col => {
      console.log(`  - ${col.name} (${col.type})`);
    });
  }
});

// Check tasks table
db.all("PRAGMA table_info(tasks)", (err, columns) => {
  if (err) {
    console.log('❌ Tasks table does not exist');
  } else {
    console.log('\n📝 TASKS table columns:');
    columns.forEach(col => {
      console.log(`  - ${col.name} (${col.type})`);
    });
  }
});

// Check task_history table
db.all("PRAGMA table_info(task_history)", (err, columns) => {
  if (err) {
    console.log('❌ Task_history table does not exist');
  } else {
    console.log('\n📜 TASK_HISTORY table columns:');
    columns.forEach(col => {
      console.log(`  - ${col.name} (${col.type})`);
    });
  }
});

// Show data relationships
setTimeout(() => {
  console.log('\n\n📊 DATA RELATIONSHIPS:');
  console.log('=====================');
  
  // Show workspaces
  db.all("SELECT * FROM workspaces", (err, rows) => {
    if (err) {
      console.log('❌ Error getting workspaces:', err.message);
    } else {
      console.log('\n🏢 Workspaces:');
      rows.forEach(row => {
        console.log(`  ID: ${row.id}, Name: "${row.name}", Description: "${row.description}"`);
      });
    }
  });
  
  // Show tags with workspace info
  db.all("SELECT t.*, w.name as workspace_name FROM tags t LEFT JOIN workspaces w ON t.workspace_id = w.id", (err, rows) => {
    if (err) {
      console.log('❌ Error getting tags:', err.message);
    } else {
      console.log('\n🏷️ Tags with workspace:');
      rows.forEach(row => {
        console.log(`  ID: ${row.id}, Name: "${row.name}", Workspace: ${row.workspace_id} (${row.workspace_name})`);
      });
    }
  });
  
  // Show tasks with workspace info
  db.all("SELECT t.id, t.title, t.workspace_id, w.name as workspace_name FROM tasks t LEFT JOIN workspaces w ON t.workspace_id = w.id LIMIT 10", (err, rows) => {
    if (err) {
      console.log('❌ Error getting tasks:', err.message);
    } else {
      console.log('\n📝 Sample Tasks with workspace:');
      rows.forEach(row => {
        console.log(`  ID: ${row.id}, Title: "${row.title}", Workspace: ${row.workspace_id} (${row.workspace_name})`);
      });
    }
  });
  
  // Show counts
  setTimeout(() => {
    console.log('\n\n📈 COUNTS:');
    console.log('==========');
    
    db.get("SELECT COUNT(*) as count FROM workspaces", (err, row) => {
      if (!err) console.log(`Workspaces: ${row.count}`);
    });
    
    db.get("SELECT COUNT(*) as count FROM tags", (err, row) => {
      if (!err) console.log(`Tags: ${row.count}`);
    });
    
    db.get("SELECT COUNT(*) as count FROM tasks", (err, row) => {
      if (!err) console.log(`Tasks: ${row.count}`);
    });
    
    db.get("SELECT COUNT(*) as count FROM task_history", (err, row) => {
      if (!err) console.log(`Task History: ${row.count}`);
    });
    
    // Show workspace distribution
    setTimeout(() => {
      console.log('\n\n🗂️ WORKSPACE DISTRIBUTION:');
      console.log('==========================');
      
      db.all("SELECT workspace_id, COUNT(*) as count FROM tags GROUP BY workspace_id", (err, rows) => {
        if (err) {
          console.log('❌ Error getting tag distribution:', err.message);
        } else {
          console.log('\nTags by workspace:');
          rows.forEach(row => {
            console.log(`  Workspace ${row.workspace_id}: ${row.count} tags`);
          });
        }
      });
      
      db.all("SELECT workspace_id, COUNT(*) as count FROM tasks GROUP BY workspace_id", (err, rows) => {
        if (err) {
          console.log('❌ Error getting task distribution:', err.message);
        } else {
          console.log('\nTasks by workspace:');
          rows.forEach(row => {
            console.log(`  Workspace ${row.workspace_id}: ${row.count} tasks`);
          });
        }
        
        // Close database
        setTimeout(() => {
          db.close();
          console.log('\n✅ Database check completed');
        }, 1000);
      });
    }, 1000);
  }, 1000);
}, 1000); 