const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const moment = require('moment-timezone');
const fs = require('fs');
const path = require('path');
const { db, initializeDatabase, updateTaskModified, addTaskHistory } = require('./database-pg');
const BackupManager = require('./backup');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize database and perform automatic backup on startup
async function initializeServer() {
  try {
    // Initialize database first
    await initializeDatabase();
    console.log('Database initialized successfully');
    
    // Perform automatic backup with change detection
    const backupManager = new BackupManager();
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
  const today = moment().tz('America/New_York');
  let nextDay = moment().tz('America/New_York').add(1, 'day');
  
  // Skip weekends
  while (nextDay.day() === 0 || nextDay.day() === 6) {
    nextDay.add(1, 'day');
  }
  
  return nextDay.format('YYYY-MM-DD');
}

// Helper function to update parent task status based on sub-tasks
async function updateParentTaskStatus(parentTaskId) {
  if (!parentTaskId) return;
  
  const subTasks = await new Promise((resolve, reject) => {
    db.all("SELECT status FROM tasks WHERE parent_task_id = ?", [parentTaskId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  
  if (subTasks.length === 0) return;
  
  const statuses = subTasks.map(task => task.status);
  let newParentStatus = 'todo';
  
  if (statuses.some(s => s === 'in_progress')) {
    newParentStatus = 'in_progress';
  } else if (statuses.every(s => s === 'paused')) {
    newParentStatus = 'paused';
  } else if (statuses.every(s => s === 'done')) {
    newParentStatus = 'done';
  }
  
  await new Promise((resolve, reject) => {
    db.run("UPDATE tasks SET status = ? WHERE id = ?", [newParentStatus, parentTaskId], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  
  await updateTaskModified(parentTaskId);
  await addTaskHistory(parentTaskId, newParentStatus, 'Auto-updated based on sub-tasks');
}

// API Routes

// Get all tags
app.get('/api/tags', (req, res) => {
  const { include_hidden, workspace_id } = req.query;
  let query = "SELECT * FROM tags";
  let params = [];
  
  const conditions = [];
  
  if (include_hidden !== 'true') {
    conditions.push("hidden = false");
  }
  
  if (workspace_id) {
    conditions.push("workspace_id = ?");
    params.push(workspace_id);
  }
  
  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }
  
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
app.post('/api/tags', (req, res) => {
  const { name, workspace_id } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Tag name is required' });
    return;
  }
  
  if (!workspace_id) {
    res.status(400).json({ error: 'Workspace ID is required' });
    return;
  }
  
  db.run("INSERT INTO tags (name, workspace_id, hidden, created_at, updated_at) VALUES (?, ?, false, ?, ?) RETURNING *", 
    [name, workspace_id, moment().tz('America/New_York').format('YYYY-MM-DD HH:mm:ss'), moment().tz('America/New_York').format('YYYY-MM-DD HH:mm:ss')], function(err, row) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Return the complete tag data directly from the INSERT
    res.json(row);
  });
});

// Update tag
app.put('/api/tags/:id', (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  
  if (!name) {
    res.status(400).json({ error: 'Tag name is required' });
    return;
  }
  
  db.run("UPDATE tags SET name = ?, updated_at = ? WHERE id = ?", [name, moment().tz('America/New_York').format('YYYY-MM-DD HH:mm:ss'), id], function(err) {
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
app.patch('/api/tags/:id/toggle-hidden', (req, res) => {
  const { id } = req.params;
  
  db.run("UPDATE tags SET hidden = CASE WHEN hidden = false THEN true ELSE false END, updated_at = ? WHERE id = ?", [moment().tz('America/New_York').format('YYYY-MM-DD HH:mm:ss'), id], function(err) {
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
app.get('/api/tasks', (req, res) => {
  const { view, days, tag_id, status, priority, show_completed, workspace_id } = req.query;
  
  let query = `
    SELECT t.*, tg.name as tag_name, 
           (SELECT COUNT(*) FROM tasks WHERE parent_task_id = t.id) as sub_task_count,
           (SELECT COUNT(*) FROM tasks WHERE parent_task_id = t.id AND status = 'done') as completed_sub_tasks
    FROM tasks t
    LEFT JOIN tags tg ON t.tag_id = tg.id
    WHERE 1=1
  `;
  
  const params = [];
  
  // Filter by workspace
  if (workspace_id) {
    query += " AND t.workspace_id = ?";
    params.push(workspace_id);
  }
  
  // Filter by view type
  if (view === 'planner' && show_completed !== 'true') {
    query += " AND t.status != 'done'";
  } else if (view === 'tracker' && days) {
    const daysAgo = moment().tz('America/New_York').subtract(parseInt(days), 'days').format('YYYY-MM-DD');
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
    

    
    res.json(rows);
  });
});

// Create new task
app.post('/api/tasks', async (req, res) => {
  const { title, description, tag_id, parent_task_id, priority, due_date, workspace_id } = req.body;
  
  if (!title) {
    res.status(400).json({ error: 'Task title is required' });
    return;
  }
  
  if (!workspace_id) {
    res.status(400).json({ error: 'Workspace ID is required' });
    return;
  }
  
  // Check if due date is tomorrow and set priority to urgent
  let finalPriority = priority || 'normal';
  if (due_date && moment.tz(due_date, 'America/New_York').format('YYYY-MM-DD') === getNextBusinessDay()) {
    finalPriority = 'urgent';
  }
  
  // Parse the due date in New York timezone - due_date is DATE type, not TIMESTAMP
  const parsedDueDate = due_date ? moment.tz(due_date, 'America/New_York').format('YYYY-MM-DD') : null;
  
  db.run(`
    INSERT INTO tasks (title, description, tag_id, parent_task_id, workspace_id, priority, due_date, created_at, last_modified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `, [title, description, tag_id, parent_task_id, workspace_id, finalPriority, parsedDueDate, moment().tz('America/New_York').format('YYYY-MM-DD HH:mm:ss'), moment().tz('America/New_York').format('YYYY-MM-DD HH:mm:ss')], async function(err, row) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const taskId = row.id;
    await addTaskHistory(taskId, 'todo', 'Task created');
    
    // Update parent task status if this is a sub-task
    if (parent_task_id) {
      await updateParentTaskStatus(parent_task_id);
    }
    
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
app.patch('/api/tasks/:id/status', async (req, res) => {
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
        updateParams.push(moment().tz('America/New_York').format('YYYY-MM-DD HH:mm:ss'));
      }
    } else if (status === 'done' && currentTask.status !== 'done') {
      updateFields.push('completion_date = ?');
      updateParams.push(moment().tz('America/New_York').format('YYYY-MM-DD HH:mm:ss'));
    }
    
    updateFields.push('last_modified = ?');
    updateParams.push(moment().tz('America/New_York').format('YYYY-MM-DD HH:mm:ss'));
    
    // Add id to updateParams so the WHERE clause works
    updateParams.push(id);
    
    await new Promise((resolve, reject) => {
      db.run(`UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`, updateParams, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    await addTaskHistory(id, status, notes);
    
    // Update parent task status if this is a sub-task
    if (currentTask.parent_task_id) {
      await updateParentTaskStatus(currentTask.parent_task_id);
    }
    
    res.json({ success: true, status });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update task
app.put('/api/tasks/:id', async (req, res) => {
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
      // Parse the date in New York timezone to ensure correct local date
      const parsedStartDate = start_date ? moment.tz(start_date, 'America/New_York').startOf('day').format('YYYY-MM-DD HH:mm:ss') : null;
      updateParams.push(parsedStartDate);
    }
    
    if (due_date !== undefined) {
      updateFields.push('due_date = ?');
      // Parse the date in New York timezone - due_date is DATE type, not TIMESTAMP
      const parsedDueDate = due_date ? moment.tz(due_date, 'America/New_York').format('YYYY-MM-DD') : null;
      updateParams.push(parsedDueDate);
    }
    
    if (completion_date !== undefined) {
      updateFields.push('completion_date = ?');
      // Parse the date in New York timezone and set to end of day for completion dates
      const parsedCompletionDate = completion_date ? moment.tz(completion_date, 'America/New_York').endOf('day').format('YYYY-MM-DD HH:mm:ss') : null;
      updateParams.push(parsedCompletionDate);
    }
    
    // Always update last_modified
    updateFields.push('last_modified = ?');
    updateParams.push(moment().tz('America/New_York').format('YYYY-MM-DD HH:mm:ss'));
    
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
app.delete('/api/tasks/:id', async (req, res) => {
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
    
    // Delete sub-tasks first
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM tasks WHERE parent_task_id = ?", [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
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
    
    // Update parent task status if this was a sub-task
    if (currentTask.parent_task_id) {
      await updateParentTaskStatus(currentTask.parent_task_id);
    }
    
    res.json({ success: true });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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

// Export database
app.get('/api/export', (req, res) => {
  db.all(`
    SELECT 
      t.id,
      t.title,
      t.description,
      tg.name as tag,
      t.status,
      t.priority,
      t.due_date,
      t.start_date,
      t.completion_date,
      t.last_modified,
      t.created_at,
      (SELECT COUNT(*) FROM tasks WHERE parent_task_id = t.id) as sub_task_count
    FROM tasks t
    LEFT JOIN tags tg ON t.tag_id = tg.id
    ORDER BY t.last_modified DESC
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=tasks-export.json');
    res.json(rows);
  });
});

// Backup management endpoints

// Get backup statistics
app.get('/api/backup/stats', (req, res) => {
  try {
    const backupManager = new BackupManager();
    const stats = backupManager.getBackupStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create manual backup
app.post('/api/backup/create', async (req, res) => {
  try {
    const backupManager = new BackupManager();
    const result = await backupManager.performAutomaticBackup();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List all backups
app.get('/api/backup/list', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const backupDir = path.join(__dirname, 'backups');
    
    if (!fs.existsSync(backupDir)) {
      res.json([]);
      return;
    }
    
    const files = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('tasks-backup-') && file.endsWith('.db'))
      .map(file => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      })
      .sort((a, b) => new Date(b.modified) - new Date(a.modified));
    
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download a specific backup
app.get('/api/backup/download/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const backupPath = path.join(__dirname, 'backups', filename);
    
    if (!fs.existsSync(backupPath)) {
      res.status(404).json({ error: 'Backup file not found' });
      return;
    }
    
    res.download(backupPath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Workspace management endpoints

// Get all workspaces
app.get('/api/workspaces', (req, res) => {
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
app.post('/api/workspaces', (req, res) => {
  const { name, description } = req.body;
  
  if (!name) {
    res.status(400).json({ error: 'Workspace name is required' });
    return;
  }
  
  const now = moment().tz('America/New_York').format('YYYY-MM-DD HH:mm:ss');
  
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
app.put('/api/workspaces/:id', (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  
  if (!name) {
    res.status(400).json({ error: 'Workspace name is required' });
    return;
  }
  
  const now = moment().tz('America/New_York').format('YYYY-MM-DD HH:mm:ss');
  
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
app.delete('/api/workspaces/:id', async (req, res) => {
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
app.patch('/api/workspaces/:id/set-default', (req, res) => {
  const { id } = req.params;
  
  const now = moment().tz('America/New_York').format('YYYY-MM-DD HH:mm:ss');
  
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});