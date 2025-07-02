const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = path.join(__dirname, 'tasks.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Database Structure and Contents\n');
console.log('=====================================\n');

// Function to show table structure
function showTableStructure(tableName) {
  return new Promise((resolve, reject) => {
    console.log(`📋 Table: ${tableName}`);
    console.log('─'.repeat(50));
    
    db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      rows.forEach(row => {
        const nullable = row.notnull === 0 ? 'NULL' : 'NOT NULL';
        const defaultValue = row.dflt_value ? `DEFAULT ${row.dflt_value}` : '';
        console.log(`${row.name} (${row.type}) ${nullable} ${defaultValue}`.trim());
      });
      console.log('');
      resolve();
    });
  });
}

// Function to show table contents
function showTableContents(tableName, limit = 10) {
  return new Promise((resolve, reject) => {
    console.log(`📊 Contents of ${tableName} (showing up to ${limit} rows):`);
    console.log('─'.repeat(50));
    
    db.all(`SELECT * FROM ${tableName} LIMIT ${limit}`, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (rows.length === 0) {
        console.log('(No data)');
      } else {
        // Show column headers
        const columns = Object.keys(rows[0]);
        console.log(columns.join(' | '));
        console.log('─'.repeat(columns.join(' | ').length));
        
        // Show data rows
        rows.forEach(row => {
          const values = columns.map(col => {
            const value = row[col];
            return value === null ? 'NULL' : String(value);
          });
          console.log(values.join(' | '));
        });
      }
      console.log('');
      resolve();
    });
  });
}

// Function to show row count
function showRowCount(tableName) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(*) as count FROM ${tableName}`, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      console.log(`📈 Total rows in ${tableName}: ${row.count}`);
      resolve();
    });
  });
}

// Main execution
async function main() {
  try {
    // Show all tables
    const tables = await new Promise((resolve, reject) => {
      db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => row.name));
      });
    });
    
    console.log(`📁 Tables found: ${tables.join(', ')}\n`);
    
    // Show structure and contents for each table
    for (const table of tables) {
      await showTableStructure(table);
      await showRowCount(table);
      await showTableContents(table);
    }
    
    // Show some sample queries
    console.log('🔍 Sample Queries:');
    console.log('─'.repeat(50));
    
    // Tasks with completion dates
    console.log('\n✅ Tasks with completion dates:');
    db.all("SELECT id, title, status, completion_date FROM tasks WHERE completion_date IS NOT NULL", (err, rows) => {
      if (err) {
        console.error('Error:', err);
        return;
      }
      if (rows.length === 0) {
        console.log('(No completed tasks)');
      } else {
        rows.forEach(row => {
          console.log(`ID: ${row.id} | "${row.title}" | Status: ${row.status} | Completed: ${row.completion_date}`);
        });
      }
    });
    
    // Recent task history
    console.log('\n📝 Recent task history:');
    db.all("SELECT th.id, th.task_id, t.title, th.status, th.action_date, th.notes FROM task_history th LEFT JOIN tasks t ON th.task_id = t.id ORDER BY th.action_date DESC LIMIT 5", (err, rows) => {
      if (err) {
        console.error('Error:', err);
        return;
      }
      if (rows.length === 0) {
        console.log('(No history)');
      } else {
        rows.forEach(row => {
          console.log(`Task: "${row.title}" (ID: ${row.task_id}) | Status: ${row.status} | Date: ${row.action_date} | Notes: ${row.notes || 'None'}`);
        });
      }
      
      // Close database
      db.close();
    });
    
  } catch (error) {
    console.error('Error:', error);
    db.close();
  }
}

main(); 