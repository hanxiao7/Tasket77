const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const moment = require('moment-timezone');
const fs = require('fs');
const path = require('path');
const { pool, initializeDatabase, updateTaskModified, addTaskHistory } = require('./database-pg');
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
  
  return nextDay.format('YYYY-MM-DD');
}

// Removed updateParentTaskStatus and all parent_task_id logic

// API Routes

// Get all tags
app.get('/api/tags', authenticateToken, async (req, res) => {
  const { include_hidden, workspace_id } = req.query;
  let query = 'SELECT * FROM tags';
  const conditions = [];
  const params = [];
  // Always filter by user_id for data isolation
  conditions.push('user_id = $1');
  params.push(req.user.userId);
  if (include_hidden !== 'true') {
    conditions.push('hidden = false');
  }
  if (workspace_id) {
    conditions.push('workspace_id = $2');
    params.push(workspace_id);
  }
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY name';
  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new tag
app.post('/api/tags', authenticateToken, async (req, res) => {
  const { name, workspace_id } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Tag name is required' });
    return;
  }
  if (!workspace_id) {
    res.status(400).json({ error: 'Workspace ID is required' });
    return;
  }
  try {
    const now = moment().utc().format('YYYY-MM-DD HH:mm:ss');
    const result = await pool.query(
      'INSERT INTO tags (name, workspace_id, user_id, hidden, created_at, updated_at) VALUES ($1, $2, $3, false, $4, $4) RETURNING *',
      [name, workspace_id, req.user.userId, now]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update tag
app.put('/api/tags/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Tag name is required' });
    return;
  }
  try {
    const now = moment().utc().format('YYYY-MM-DD HH:mm:ss');
    const updateResult = await pool.query(
      'UPDATE tags SET name = $1, updated_at = $2 WHERE id = $3 AND user_id = $4 RETURNING *',
      [name, now, id, req.user.userId]
    );
    if (updateResult.rowCount === 0) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }
    res.json(updateResult.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle tag hidden status
app.patch('/api/tags/:id/toggle-hidden', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const now = moment().utc().format('YYYY-MM-DD HH:mm:ss');
    const updateResult = await pool.query(
      'UPDATE tags SET hidden = NOT hidden, updated_at = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [now, id, req.user.userId]
    );
    if (updateResult.rowCount === 0) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }
    res.json(updateResult.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete tag
app.delete('/api/tags/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE tasks SET tag_id = NULL WHERE tag_id = $1', [id]);
    const deleteResult = await pool.query('DELETE FROM tags WHERE id = $1 RETURNING *', [id]);
    if (deleteResult.rowCount === 0) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get tasks with optional filters
app.get('/api/tasks', authenticateToken, async (req, res) => {
  const { view, days, tag_id, status, priority, show_completed, workspace_id } = req.query;
  let query = `
    SELECT t.*, tg.name as tag_name
    FROM tasks t
    LEFT JOIN tags tg ON t.tag_id = tg.id
    WHERE t.user_id = $1
  `;
  const params = [req.user.userId];
  let paramIndex = 2;
  if (workspace_id) {
    query += ` AND t.workspace_id = $${paramIndex}`;
    params.push(workspace_id);
    paramIndex++;
  }
  if (view === 'planner' && show_completed !== 'true') {
    query += ' AND t.status != \'done\'';
  } else if (view === 'tracker' && days) {
    query += ` AND (t.completion_date >= $${paramIndex} OR t.status IN ('in_progress', 'paused'))`;
    const daysAgo = moment().utc().subtract(parseInt(days), 'days').format('YYYY-MM-DD');
    params.push(daysAgo);
    paramIndex++;
  }
  if (tag_id) {
    query += ` AND t.tag_id = $${paramIndex}`;
    params.push(tag_id);
    paramIndex++;
  }
  if (status) {
    query += ` AND t.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }
  if (priority) {
    query += ` AND t.priority = $${paramIndex}`;
    params.push(priority);
    paramIndex++;
  }
  if (view === 'planner') {
    query += ' ORDER BY CASE t.status WHEN \'in_progress\' THEN 1 WHEN \'paused\' THEN 1 WHEN \'todo\' THEN 3 WHEN \'done\' THEN 4 END,';
    query += ' CASE t.priority WHEN \'urgent\' THEN 1 WHEN \'high\' THEN 2 WHEN \'normal\' THEN 3 WHEN \'low\' THEN 4 END,';
    query += ' t.title ASC';
  } else if (view === 'tracker') {
    query += ' ORDER BY tg.name, CASE t.status WHEN \'done\' THEN 1 WHEN \'in_progress\' THEN 2 WHEN \'paused\' THEN 3 WHEN \'todo\' THEN 4 END,';
    query += ' t.title ASC';
  } else {
    query += ' ORDER BY t.title ASC';
  }
  try {
    const result = await pool.query(query, params);
    // Check and update priorities for tasks due tomorrow
    const nextBusinessDay = getNextBusinessDay();
    const tasksToUpdate = result.rows.filter(task => {
      if (!task.due_date || task.priority === 'urgent') return false;
      let taskDate;
      if (typeof task.due_date === 'string') {
        taskDate = task.due_date.split('T')[0];
      } else if (task.due_date instanceof Date) {
        taskDate = task.due_date.toISOString().split('T')[0];
      } else {
        return false;
      }
      return taskDate === nextBusinessDay;
    });
    if (tasksToUpdate.length > 0) {
      for (const task of tasksToUpdate) {
        pool.query('UPDATE tasks SET priority = $1 WHERE id = $2', ['urgent', task.id]);
      }
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
  
  try {
    const now = moment().utc().format('YYYY-MM-DD HH:mm:ss');
    const result = await pool.query(
      `
    INSERT INTO tasks (user_id, workspace_id, title, description, tag_id, priority, due_date, created_at, last_modified)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
    RETURNING *
  `, [req.user.userId, workspace_id, title, description, tag_id, priority || 'normal', parsedDueDate, now]
    );
    
    const taskId = result.rows[0].id;
    await addTaskHistory(taskId, 'todo', 'Task created');
    
    // Get the complete task information including tag details
    const fullRowResult = await pool.query(
      `
      SELECT t.*, tg.name as tag_name
      FROM tasks t
      LEFT JOIN tags tg ON t.tag_id = tg.id
      WHERE t.id = $1
    `, [taskId]
    );
    res.json(fullRowResult.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
    // Get current task
    const currentTaskResult = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
    const currentTask = currentTaskResult.rows[0];
    if (!currentTask) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Build dynamic update query
    let updateFields = [];
    let updateParams = [];
    let paramIndex = 1;

    // Always update status
    updateFields.push(`status = $${paramIndex}`);
    updateParams.push(status);
    paramIndex++;

    // Update relevant dates based on status change
    if (status === 'in_progress' && currentTask.status !== 'in_progress') {
      if (!currentTask.start_date) {
        updateFields.push(`start_date = $${paramIndex}`);
        updateParams.push(moment().format('YYYY-MM-DD'));
        paramIndex++;
      }
    } else if (status === 'done' && currentTask.status !== 'done') {
      updateFields.push(`completion_date = $${paramIndex}`);
      updateParams.push(moment().format('YYYY-MM-DD'));
      paramIndex++;
    }

    // Always update last_modified
    updateFields.push(`last_modified = $${paramIndex}`);
    updateParams.push(moment().utc().format('YYYY-MM-DD HH:mm:ss'));
    paramIndex++;

    // Add id for WHERE clause
    updateParams.push(id);

    const updateQuery = `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`;
    await pool.query(updateQuery, updateParams);

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
    const currentTaskResult = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
    const currentTask = currentTaskResult.rows[0];
    if (!currentTask) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Build dynamic update query based on provided fields
    const updateFields = [];
    const updateParams = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updateFields.push(`title = $${paramIndex}`);
      updateParams.push(title);
      paramIndex++;
    }
    if (description !== undefined) {
      updateFields.push(`description = $${paramIndex}`);
      updateParams.push(description);
      paramIndex++;
    }
    if (tag_id !== undefined) {
      updateFields.push(`tag_id = $${paramIndex}`);
      updateParams.push(tag_id);
      paramIndex++;
    }
    if (priority !== undefined) {
      updateFields.push(`priority = $${paramIndex}`);
      updateParams.push(priority);
      paramIndex++;
    }
    if (status !== undefined) {
      updateFields.push(`status = $${paramIndex}`);
      updateParams.push(status);
      paramIndex++;
    }
    if (start_date !== undefined) {
      updateFields.push(`start_date = $${paramIndex}`);
      const parsedStartDate = start_date ? start_date : null;
      updateParams.push(parsedStartDate);
      paramIndex++;
    }
    if (due_date !== undefined) {
      updateFields.push(`due_date = $${paramIndex}`);
      const parsedDueDate = due_date ? due_date : null;
      updateParams.push(parsedDueDate);
      paramIndex++;
      // Check if due date is tomorrow and set priority to urgent
      const nextBusinessDay = getNextBusinessDay();
      if (due_date && due_date === nextBusinessDay) {
        updateFields.push(`priority = $${paramIndex}`);
        updateParams.push('urgent');
        paramIndex++;
      }
    }
    if (completion_date !== undefined) {
      updateFields.push(`completion_date = $${paramIndex}`);
      const parsedCompletionDate = completion_date ? completion_date : null;
      updateParams.push(parsedCompletionDate);
      paramIndex++;
    }
    // Always update last_modified
    updateFields.push(`last_modified = $${paramIndex}`);
    updateParams.push(moment().utc().format('YYYY-MM-DD HH:mm:ss'));
    paramIndex++;

    // Add id for WHERE clause
    updateParams.push(id);

    if (updateFields.length > 0) {
      const updateQuery = `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`;
      await pool.query(updateQuery, updateParams);
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
    const currentTask = await pool.query("SELECT * FROM tasks WHERE id = $1", [id]);
    
    if (currentTask.rowCount === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    
    // Delete task history
    await pool.query("DELETE FROM task_history WHERE task_id = $1", [id]);
    
    // Delete the task
    await pool.query("DELETE FROM tasks WHERE id = $1", [id]);
    
    res.json({ success: true });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single task
app.get('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  
  pool.query(`
    SELECT t.*, tg.name as tag_name
    FROM tasks t
    LEFT JOIN tags tg ON t.tag_id = tg.id
    WHERE t.id = $1
  `, [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row.rows[0]) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json(row.rows[0]);
  });
});

// Get task history
app.get('/api/tasks/:id/history', (req, res) => {
  const { id } = req.params;
  
  pool.query("SELECT * FROM task_history WHERE task_id = $1 ORDER BY action_date DESC", [id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows.rows);
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
            INSERT INTO tasks (id, user_id, workspace_id, title, description, tag_id, priority, status, due_date, start_date, completion_date, last_modified, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (id) DO UPDATE SET
              user_id = EXCLUDED.user_id,
              workspace_id = EXCLUDED.workspace_id,
              title = EXCLUDED.title,
              description = EXCLUDED.description,
              tag_id = EXCLUDED.tag_id,
              priority = EXCLUDED.priority,
              status = EXCLUDED.status,
              due_date = EXCLUDED.due_date,
              start_date = EXCLUDED.start_date,
              completion_date = EXCLUDED.completion_date,
              last_modified = EXCLUDED.last_modified
          `, [
            task.id,
            task.user_id,
            task.workspace_id,
            task.title,
            task.description,
            task.tag_id,
            task.priority,
            task.status,
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
app.get('/api/workspaces', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM workspaces ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error('Workspaces query error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create new workspace
app.post('/api/workspaces', authenticateToken, async (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Workspace name is required' });
    return;
  }
  const now = moment().utc().format('YYYY-MM-DD HH:mm:ss');
  try {
    const result = await pool.query(
      'INSERT INTO workspaces (name, description, is_default, created_at, updated_at) VALUES ($1, $2, false, $3, $3) RETURNING *',
      [name, description || '', now]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update workspace
app.put('/api/workspaces/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Workspace name is required' });
    return;
  }
  const now = moment().utc().format('YYYY-MM-DD HH:mm:ss');
  try {
    const updateResult = await pool.query(
      'UPDATE workspaces SET name = $1, description = $2, updated_at = $3 WHERE id = $4 RETURNING *',
      [name, description || '', now, id]
    );
    if (updateResult.rowCount === 0) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }
    res.json(updateResult.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete workspace
app.delete('/api/workspaces/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    if (id == 1) {
      res.status(400).json({ error: 'Cannot delete the default workspace' });
      return;
    }
    await pool.query('DELETE FROM tasks WHERE workspace_id = $1', [id]);
    await pool.query('DELETE FROM tags WHERE workspace_id = $1', [id]);
    const deleteResult = await pool.query('DELETE FROM workspaces WHERE id = $1 RETURNING *', [id]);
    if (deleteResult.rowCount === 0) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Set workspace as default
app.patch('/api/workspaces/:id/set-default', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const now = moment().utc().format('YYYY-MM-DD HH:mm:ss');
  try {
    await pool.query('UPDATE workspaces SET is_default = false, updated_at = $1', [now]);
    const updateResult = await pool.query('UPDATE workspaces SET is_default = true, updated_at = $1 WHERE id = $2 RETURNING *', [now, id]);
    if (updateResult.rowCount === 0) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }
    res.json(updateResult.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Authentication routes (no auth required)
app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});