const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const moment = require('moment-timezone');
const fs = require('fs');
const path = require('path');
const { db, initializeDatabase, updateTaskModified, addTaskHistory } = require('./database-pg');
const PostgreSQLBackupManager = require('./backup-pg');
const { authenticateToken } = require('./middleware/auth');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || 'http://localhost:3000'
    : 'http://localhost:3000',
  credentials: true
}));

// Middleware
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize database and perform automatic backup on startup
async function initializeServer() {
  try {
    // Initialize database first
    await initializeDatabase();
    console.log('Database initialized successfully');
    
    // Perform automatic backup with change detection
    const backupManager = new PostgreSQLBackupManager();
    const backupResult = await backupManager.performAutomaticBackup();
    
    if (backupResult.success) {
      if (backupResult.skipped) {
        console.log(`Backup skipped: ${backupResult.reason}`);
      } else {
        console.log(`Backup completed: ${backupResult.reason}`);
      }
    } else {
      console.error('Backup failed:', backupResult.error);
    }
    
  } catch (err) {
    console.error('Server initialization failed:', err);
  }
}

initializeServer();

// Helper function to get next business day
function getNextBusinessDay() {
  const today = moment(); // Use local time instead of UTC
  let nextDay = moment().add(1, 'day'); // Use local time instead of UTC
  
  // Skip weekends
  while (nextDay.day() === 0 || nextDay.day() === 6) {
    nextDay = nextDay.add(1, 'day'); // Fix: reassign to avoid mutation issues
  }
  
  console.log('🔍 getNextBusinessDay debug:', {
    today: today.format('YYYY-MM-DD'),
    todayDay: today.day(),
    nextDay: nextDay.format('YYYY-MM-DD'),
    nextDayDay: nextDay.day()
  });
  
  return nextDay.format('YYYY-MM-DD');
}

// Removed updateParentTaskStatus and all parent_task_id logic

// API Routes

// Get all tags
app.get('/api/tags', authenticateToken, (req, res) => {
  const { include_hidden, workspace_id } = req.query;
  let query = "SELECT * FROM tags";
  let params = [];
  
  const conditions = [];
  
  // Always filter by user_id for data isolation
  conditions.push("user_id = ?");
  params.push(req.user.userId);
  
  if (include_hidden !== 'true') {
    conditions.push("hidden = false");
  }
  
  if (workspace_id) {
    conditions.push("workspace_id = ?");
    params.push(workspace_id);
  }
  
  query += " WHERE " + conditions.join(" AND ");
  query += " ORDER BY name";
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Create new tag
app.post('/api/tags', authenticateToken, (req, res) => {
  const { name, workspace_id } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Tag name is required' });
    return;
  }
  
  if (!workspace_id) {
    res.status(400).json({ error: 'Workspace ID is required' });
    return;
  }
  
  db.run("INSERT INTO tags (name, workspace_id, user_id, hidden, created_at, updated_at) VALUES (?, ?, ?, false, ?, ?) RETURNING *", 
    [name, workspace_id, req.user.userId, moment().utc().format('YYYY-MM-DD HH:mm:ss'), moment().utc().format('YYYY-MM-DD HH:mm:ss')], function(err, row) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Return the complete tag data directly from the INSERT
    res.json(row);
  });
});

// Update tag
app.put('/api/tags/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  
  if (!name) {
    res.status(400).json({ error: 'Tag name is required' });
    return;
  }
  
  db.run("UPDATE tags SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?", [name, moment().utc().format('YYYY-MM-DD HH:mm:ss'), id, req.user.userId], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }
    
    // Get the complete updated tag data
    db.get("SELECT * FROM tags WHERE id = ?", [id], (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(row);
    });
  });
});

// Toggle tag hidden status
app.patch('/api/tags/:id/toggle-hidden', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.run("UPDATE tags SET hidden = CASE WHEN hidden = false THEN true ELSE false END, updated_at = ? WHERE id = ? AND user_id = ?", [moment().utc().format('YYYY-MM-DD HH:mm:ss'), id, req.user.userId], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }
    
    // Get the updated tag
    db.get("SELECT * FROM tags WHERE id = ?", [id], (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(row);
    });
  });
});

// Delete tag
app.delete('/api/tags/:id', (req, res) => {
  const { id } = req.params;
  
  // First, remove the tag from all tasks
  db.run("UPDATE tasks SET tag_id = NULL WHERE tag_id = ?", [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Then delete the tag
    db.run("DELETE FROM tags WHERE id = ?", [id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Tag not found' });
        return;
      }
      res.json({ success: true });
    });
  });
});

// Get tasks with optional filters
app.get('/api/tasks', authenticateToken, (req, res) => {
  const { view, days, tag_id, status, priority, show_completed, workspace_id } = req.query;
  
  let query = `
    SELECT t.*, tg.name as tag_name
    FROM tasks t
    LEFT JOIN tags tg ON t.tag_id = tg.id
    WHERE t.user_id = ?
  `;
  
  const params = [req.user.userId];
  
  // Filter by workspace
  if (workspace_id) {
    query += " AND t.workspace_id = ?";
    params.push(workspace_id);
  }
  
  // Filter by view type
  if (view === 'planner' && show_completed !== 'true') {
    query += " AND t.status != 'done'";
  } else if (view === 'tracker' && days) {
    const daysAgo = moment().utc().subtract(parseInt(days), 'days').format('YYYY-MM-DD');
    // Show tasks that were completed in the past X days OR are currently in progress or paused
    query += " AND (t.completion_date >= ? OR t.status IN ('in_progress', 'paused'))";
    params.push(daysAgo);
  }
  
  // Additional filters
  if (tag_id) {
    query += " AND t.tag_id = ?";
    params.push(tag_id);
  }
  
  if (status) {
    query += " AND t.status = ?";
    params.push(status);
  }
  
  if (priority) {
    query += " AND t.priority = ?";
    params.push(priority);
  }
  
  // Sorting
  if (view === 'planner') {
    query += " ORDER BY CASE t.status WHEN 'in_progress' THEN 1 WHEN 'paused' THEN 1 WHEN 'todo' THEN 3 WHEN 'done' THEN 4 END, ";
    query += " CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 END, ";
    query += " t.title ASC";
  } else if (view === 'tracker') {
    query += " ORDER BY tg.name, CASE t.status WHEN 'done' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'paused' THEN 3 WHEN 'todo' THEN 4 END, ";
    query += " t.title ASC";
  } else {
    query += " ORDER BY t.title ASC";
  }
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Check and update priorities for tasks due tomorrow
    const nextBusinessDay = getNextBusinessDay();
    console.log('🔍 Checking priorities on load, next business day:', nextBusinessDay);
    console.log('🔍 Total tasks loaded:', rows.length);
    
    const tasksToUpdate = rows.filter(task => {
      if (!task.due_date || task.priority === 'urgent') return false;
      
      // Handle both string and Date object formats
      let taskDate;
      if (typeof task.due_date === 'string') {
        taskDate = task.due_date.split('T')[0];
      } else if (task.due_date instanceof Date) {
        taskDate = task.due_date.toISOString().split('T')[0];
      } else {
        console.log('🔍 Unexpected due_date format:', typeof task.due_date, task.due_date);
        return false;
      }
      
      console.log('🔍 Comparing:', { taskDate, nextBusinessDay, isMatch: taskDate === nextBusinessDay });
      
      return taskDate === nextBusinessDay;
    });
    
    console.log('🔍 Tasks with due dates:', rows.filter(t => t.due_date).map(t => ({ id: t.id, title: t.title, due_date: t.due_date, priority: t.priority })));
    console.log('🔍 Tasks to update:', tasksToUpdate.length);
    
    if (tasksToUpdate.length > 0) {
      console.log('🚨 Found tasks due tomorrow that need urgent priority:', tasksToUpdate.map(t => ({ id: t.id, title: t.title, due_date: t.due_date })));
      
      // Update priorities in background (don't wait for completion)
      tasksToUpdate.forEach((task) => {
        db.run("UPDATE tasks SET priority = ? WHERE id = ?", ['urgent', task.id], function(err) {
          if (err) {
            console.error(`❌ Failed to update task ${task.id} priority:`, err);
          } else {
            console.log(`✅ Updated task ${task.id} priority to urgent`);
          }
        });
      });
    }
    
    res.json(rows);
  });
});

// Create new task
app.post('/api/tasks', authenticateToken, async (req, res) => {
  const { title, description, tag_id, priority, due_date, workspace_id } = req.body;
  
  if (!title) {
    res.status(400).json({ error: 'Task title is required' });
    return;
  }
  
  if (!workspace_id) {
    res.status(400).json({ error: 'Workspace ID is required' });
    return;
  }
  
  // Parse the due date - due_date is DATE type, not TIMESTAMP
  const parsedDueDate = due_date ? due_date : null;
  
  db.run(`
    INSERT INTO tasks (title, description, tag_id, workspace_id, user_id, priority, due_date, created_at, last_modified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `, [title, description, tag_id, workspace_id, req.user.userId, priority || 'normal', parsedDueDate, moment().utc().format('YYYY-MM-DD HH:mm:ss'), moment().utc().format('YYYY-MM-DD HH:mm:ss')], async function(err, row) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const taskId = row.id;
    await addTaskHistory(taskId, 'todo', 'Task created');
    
    // Get the complete task information including tag details
    db.get(`
      SELECT t.*, tg.name as tag_name
      FROM tasks t
      LEFT JOIN tags tg ON t.tag_id = tg.id
      WHERE t.id = ?
    `, [taskId], (err, fullRow) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(fullRow);
    });
  });
});

// Update task status
app.patch('/api/tasks/:id/status', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;
  
  const validStatuses = ['todo', 'in_progress', 'paused', 'done'];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }
  
  try {
    const currentTask = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM tasks WHERE id = ?", [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!currentTask) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    
    let updateFields = ['status = ?'];
    let updateParams = [status];
    
    // Update relevant dates based on status change
    if (status === 'in_progress' && currentTask.status !== 'in_progress') {
      // Only set start_date if it's not already set (keep the earliest date)
      if (!currentTask.start_date) {
        updateFields.push('start_date = ?');
        updateParams.push(moment().format('YYYY-MM-DD'));
      }
    } else if (status === 'done' && currentTask.status !== 'done') {
      updateFields.push('completion_date = ?');
      updateParams.push(moment().format('YYYY-MM-DD'));
    }
    
    updateFields.push('last_modified = ?');
    updateParams.push(moment().utc().format('YYYY-MM-DD HH:mm:ss'));
    
    // Add id to updateParams so the WHERE clause works
    updateParams.push(id);
    
    await new Promise((resolve, reject) => {
      db.run(`UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`, updateParams, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    await addTaskHistory(id, status, notes);
    
    res.json({ success: true, status });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update task
app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { title, description, tag_id, priority, status, start_date, due_date, completion_date } = req.body;
  
  try {
    const currentTask = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM tasks WHERE id = ?", [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!currentTask) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    
    // Build dynamic update query based on provided fields
    const updateFields = [];
    const updateParams = [];
    
    // Only update fields that are actually provided in the request
    if (title !== undefined) {
      updateFields.push('title = ?');
      updateParams.push(title);
    }
    
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateParams.push(description);
    }
    
    if (tag_id !== undefined) {
      updateFields.push('tag_id = ?');
      updateParams.push(tag_id);
    }
    
    if (priority !== undefined) {
      updateFields.push('priority = ?');
      updateParams.push(priority);
    }
    
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateParams.push(status);
    }
    
    if (start_date !== undefined) {
      updateFields.push('start_date = ?');
      // Parse the date - start_date is DATE type
      const parsedStartDate = start_date ? start_date : null;
      updateParams.push(parsedStartDate);
    }
    
    if (due_date !== undefined) {
      updateFields.push('due_date = ?');
      // Parse the date - due_date is DATE type, not TIMESTAMP
      const parsedDueDate = due_date ? due_date : null;
      updateParams.push(parsedDueDate);
      
      // Check if due date is tomorrow and set priority to urgent
      const nextBusinessDay = getNextBusinessDay();
      console.log('🔍 Priority check (update):', { due_date, nextBusinessDay, isMatch: due_date === nextBusinessDay });
      if (due_date && due_date === nextBusinessDay) {
        updateFields.push('priority = ?');
        updateParams.push('urgent');
        console.log('🚨 Setting priority to urgent on update!');
      }
    }
    
    if (completion_date !== undefined) {
      updateFields.push('completion_date = ?');
      // Parse the date - completion_date is DATE type
      const parsedCompletionDate = completion_date ? completion_date : null;
      updateParams.push(parsedCompletionDate);
    }
    
    // Always update last_modified
    updateFields.push('last_modified = ?');
    updateParams.push(moment().utc().format('YYYY-MM-DD HH:mm:ss'));
    
    // Add id to updateParams for WHERE clause
    updateParams.push(id);
    
    // Only perform update if there are fields to update
    if (updateFields.length > 1) { // > 1 because we always add last_modified
      await new Promise((resolve, reject) => {
        db.run(`UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`, updateParams, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // Add task history if status was updated
      if (status !== undefined && status !== currentTask.status) {
        await addTaskHistory(id, status, 'Status updated via edit');
      }
    }
    
    res.json({ success: true });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete task
app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    const currentTask = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM tasks WHERE id = ?", [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!currentTask) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    
    // Delete task history
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM task_history WHERE task_id = ?", [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Delete the task
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM tasks WHERE id = ?", [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    res.json({ success: true });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single task
app.get('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(`
    SELECT t.*, tg.name as tag_name
    FROM tasks t
    LEFT JOIN tags tg ON t.tag_id = tg.id
    WHERE t.id = ?
  `, [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json(row);
  });
});

// Get task history
app.get('/api/tasks/:id/history', (req, res) => {
  const { id } = req.params;
  
  db.all("SELECT * FROM task_history WHERE task_id = ? ORDER BY action_date DESC", [id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Export all tasks as JSON
app.get('/api/export', authenticateToken, async (req, res) => {
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/taskmanagement',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    const client = await pool.connect();
    
    // Get all data
    const workspaces = await client.query('SELECT * FROM workspaces ORDER BY id');
    const tags = await client.query('SELECT * FROM tags ORDER BY id');
    const tasks = await client.query('SELECT * FROM tasks ORDER BY id');
    const taskHistory = await client.query('SELECT * FROM task_history ORDER BY id');
    
    const exportData = {
      exportDate: new Date().toISOString(),
      version: '2.0',
      workspaces: workspaces.rows,
      tags: tags.rows,
      tasks: tasks.rows,
      taskHistory: taskHistory.rows
    };
    
    client.release();
    await pool.end();
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="tasks-export.json"');
    res.json(exportData);
    
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

// Import data from JSON backup
app.post('/api/import', authenticateToken, async (req, res) => {
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/taskmanagement',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    const client = await pool.connect();
    
    // Begin transaction
    await client.query('BEGIN');
    
    try {
      const importData = req.body;
      
      // Clear existing data
      await client.query('DELETE FROM task_history');
      await client.query('DELETE FROM tasks');
      await client.query('DELETE FROM tags');
      await client.query('DELETE FROM workspaces');
      
      // Import workspaces
      if (importData.workspaces && importData.workspaces.length > 0) {
        for (const workspace of importData.workspaces) {
          await client.query(`
            INSERT INTO workspaces (id, name, description, is_default, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              description = EXCLUDED.description,
              is_default = EXCLUDED.is_default,
              updated_at = EXCLUDED.updated_at
          `, [
            workspace.id,
            workspace.name,
            workspace.description,
            workspace.is_default,
            workspace.created_at,
            workspace.updated_at
          ]);
        }
      }
      
      // Import tags
      if (importData.tags && importData.tags.length > 0) {
        for (const tag of importData.tags) {
          await client.query(`
            INSERT INTO tags (id, name, workspace_id, hidden, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              workspace_id = EXCLUDED.workspace_id,
              hidden = EXCLUDED.hidden,
              updated_at = EXCLUDED.updated_at
          `, [
            tag.id,
            tag.name,
            tag.workspace_id,
            tag.hidden,
            tag.created_at,
            tag.updated_at
          ]);
        }
      }
      
      // Import tasks
      if (importData.tasks && importData.tasks.length > 0) {
        for (const task of importData.tasks) {
          await client.query(`
            INSERT INTO tasks (id, title, description, tag_id, workspace_id, status, priority, due_date, start_date, completion_date, last_modified, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (id) DO UPDATE SET
              title = EXCLUDED.title,
              description = EXCLUDED.description,
              tag_id = EXCLUDED.tag_id,
              workspace_id = EXCLUDED.workspace_id,
              status = EXCLUDED.status,
              priority = EXCLUDED.priority,
              due_date = EXCLUDED.due_date,
              start_date = EXCLUDED.start_date,
              completion_date = EXCLUDED.completion_date,
              last_modified = EXCLUDED.last_modified,
              updated_at = CURRENT_TIMESTAMP
          `, [
            task.id,
            task.title,
            task.description,
            task.tag_id,
            task.workspace_id,
            task.status,
            task.priority,
            task.due_date,
            task.start_date,
            task.completion_date,
            task.last_modified,
            task.created_at
          ]);
        }
      }
      
      // Import task history
      if (importData.taskHistory && importData.taskHistory.length > 0) {
        for (const history of importData.taskHistory) {
          await client.query(`
            INSERT INTO task_history (id, task_id, status, action_date, notes)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id) DO UPDATE SET
              task_id = EXCLUDED.task_id,
              status = EXCLUDED.status,
              action_date = EXCLUDED.action_date,
              notes = EXCLUDED.notes
          `, [
            history.id,
            history.task_id,
            history.status,
            history.action_date,
            history.notes
          ]);
        }
      }
      
      // Commit transaction
      await client.query('COMMIT');
      
      client.release();
      await pool.end();
      
      res.json({ 
        success: true, 
        message: 'Import completed successfully',
        imported: {
          workspaces: importData.workspaces?.length || 0,
          tags: importData.tags?.length || 0,
          tasks: importData.tasks?.length || 0,
          taskHistory: importData.taskHistory?.length || 0
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Import failed: ' + error.message });
  }
});

// Backup management endpoints

// Get backup statistics
app.get('/api/backup/stats', authenticateToken, async (req, res) => {
  try {
    const backupManager = new PostgreSQLBackupManager();
    const stats = await backupManager.getBackupStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create manual backup
app.post('/api/backup/create', authenticateToken, async (req, res) => {
  try {
    const backupManager = new PostgreSQLBackupManager();
    const result = await backupManager.performAutomaticBackup();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List all backups
app.get('/api/backup/list', authenticateToken, async (req, res) => {
  try {
    const backupManager = new PostgreSQLBackupManager();
    const backups = await backupManager.listBackups();
    res.json(backups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Restore from backup
app.post('/api/backup/restore/:prefix', authenticateToken, async (req, res) => {
  try {
    const { prefix } = req.params;
    const backupManager = new PostgreSQLBackupManager();
    const result = await backupManager.restoreFromBackup(prefix);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Workspace management endpoints

// Get all workspaces
app.get('/api/workspaces', authenticateToken, (req, res) => {
  const { pool } = require('./database-pg');
  
  pool.query("SELECT * FROM workspaces ORDER BY name")
    .then(result => {
      res.json(result.rows);
    })
    .catch(err => {
      console.error('Workspaces query error:', err);
      res.status(500).json({ error: err.message });
    });
});

// Create new workspace
app.post('/api/workspaces', authenticateToken, (req, res) => {
  const { name, description } = req.body;
  
  if (!name) {
    res.status(400).json({ error: 'Workspace name is required' });
    return;
  }
  
  const now = moment().utc().format('YYYY-MM-DD HH:mm:ss');
  
  db.run("INSERT INTO workspaces (name, description, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?) RETURNING *", 
    [name, description || '', false, now, now], function(err, row) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Return the complete workspace data directly from the INSERT
    res.json(row);
  });
});

// Update workspace
app.put('/api/workspaces/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  
  if (!name) {
    res.status(400).json({ error: 'Workspace name is required' });
    return;
  }
  
  const now = moment().utc().format('YYYY-MM-DD HH:mm:ss');
  
  db.run("UPDATE workspaces SET name = ?, description = ?, updated_at = ? WHERE id = ?", 
    [name, description || '', now, id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }
    
    // Get the complete updated workspace data
    db.get("SELECT * FROM workspaces WHERE id = ?", [id], (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(row);
    });
  });
});

// Delete workspace
app.delete('/api/workspaces/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    // Check if this is the default workspace (id = 1)
    if (id == 1) {
      res.status(400).json({ error: 'Cannot delete the default workspace' });
      return;
    }
    
    // Delete all tasks in this workspace
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM tasks WHERE workspace_id = ?", [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Delete all tags in this workspace
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM tags WHERE workspace_id = ?", [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Delete the workspace
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM workspaces WHERE id = ?", [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    res.json({ success: true });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set workspace as default
app.patch('/api/workspaces/:id/set-default', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  const now = moment().utc().format('YYYY-MM-DD HH:mm:ss');
  
  // First, clear all default flags
  db.run("UPDATE workspaces SET is_default = false, updated_at = ?", [now], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Then set the specified workspace as default
    db.run("UPDATE workspaces SET is_default = true, updated_at = ? WHERE id = ?", [now, id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Workspace not found' });
        return;
      }
      
      // Get the complete updated workspace data
      db.get("SELECT * FROM workspaces WHERE id = ?", [id], (err, row) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json(row);
      });
    });
  });
});

// Authentication routes (no auth required)
app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});