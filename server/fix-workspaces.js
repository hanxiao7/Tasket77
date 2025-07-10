const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'tasks.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Fixing workspace duplicates...\n');

// First, let's see what we have
db.all('SELECT * FROM workspaces ORDER BY id', (err, workspaces) => {
  if (err) {
    console.error('Error getting workspaces:', err);
    db.close();
    return;
  }
  
  console.log('Current workspaces:');
  workspaces.forEach((ws, i) => {
    console.log(`${i+1}. ID: ${ws.id}, Name: "${ws.name}", Created: ${ws.created_at}`);
  });
  
  if (workspaces.length <= 1) {
    console.log('\n✅ No duplicates found. Only one workspace exists.');
    db.close();
    return;
  }
  
  console.log(`\n⚠️  Found ${workspaces.length} workspaces. Need to clean up duplicates.`);
  
  // Keep the first workspace (ID 1) and remove the rest
  const workspaceIdsToRemove = workspaces.slice(1).map(ws => ws.id);
  
  console.log(`\n🗑️  Removing workspaces with IDs: ${workspaceIdsToRemove.join(', ')}`);
  
  // First, update all tasks to use workspace ID 1
  db.run("UPDATE tasks SET workspace_id = 1 WHERE workspace_id IN (" + workspaceIdsToRemove.map(() => '?').join(',') + ")", 
    workspaceIdsToRemove, function(err) {
    if (err) {
      console.error('Error updating tasks:', err);
      db.close();
      return;
    }
    console.log(`✅ Updated ${this.changes} tasks to use workspace ID 1`);
    
    // Update all tags to use workspace ID 1
    db.run("UPDATE tags SET workspace_id = 1 WHERE workspace_id IN (" + workspaceIdsToRemove.map(() => '?').join(',') + ")", 
      workspaceIdsToRemove, function(err) {
      if (err) {
        console.error('Error updating tags:', err);
        db.close();
        return;
      }
      console.log(`✅ Updated ${this.changes} tags to use workspace ID 1`);
      
      // Now remove the duplicate workspaces
      db.run("DELETE FROM workspaces WHERE id IN (" + workspaceIdsToRemove.map(() => '?').join(',') + ")", 
        workspaceIdsToRemove, function(err) {
        if (err) {
          console.error('Error removing workspaces:', err);
          db.close();
          return;
        }
        console.log(`✅ Removed ${this.changes} duplicate workspaces`);
        
        // Verify the fix
        db.get('SELECT * FROM workspaces', (err, workspace) => {
          if (err) {
            console.error('Error verifying fix:', err);
          } else {
            console.log(`\n✅ Fix completed! Only workspace remains:`);
            console.log(`   ID: ${workspace.id}, Name: "${workspace.name}"`);
          }
          db.close();
        });
      });
    });
  });
}); 