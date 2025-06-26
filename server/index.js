const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const moment = require('moment');
const { db, initializeDatabase, updateTaskModified, addTaskHistory } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize database on startup
initializeDatabase().then(() => {
  console.log('Database initialized successfully');
}).catch(err => {
  console.error('Database initialization failed:', err);
});

// Helper function to get next business day
function getNextBusinessDay() {
  const today = moment();
  let nextDay = moment().add(1, 'day');
  
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

// Get all areas
app.get('/api/areas', (req, res) => {
  db.all("SELECT * FROM areas ORDER BY name", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Create new area
app.post('/api/areas', (req, res) => {
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Area name is required' });
    return;
  }
  
  db.run("INSERT INTO areas (name) VALUES (?)", [name], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, name });
  });
});

// Get tasks with optional filters
app.get('/api/tasks', (req, res) => {
  const { view, days, area_id, status, priority, show_completed } = req.query;
  
  let query = `
    SELECT t.*, a.name as area_name, 
           (SELECT COUNT(*) FROM tasks WHERE parent_task_id = t.id) as sub_task_count,
           (SELECT COUNT(*) FROM tasks WHERE parent_task_id = t.id AND status = 'done') as completed_sub_tasks
    FROM tasks t
    LEFT JOIN areas a ON t.area_id = a.id
    WHERE 1=1
  `;
  
  const params = [];
  
  // Filter by view type
  if (view === 'planner' && show_completed !== 'true') {
    query += " AND t.status != 'done'";
  } else if (view === 'tracker' && days) {
    const daysAgo = moment().subtract(parseInt(days), 'days').format('YYYY-MM-DD HH:mm:ss');
    query += " AND t.last_modified >= ?";
    params.push(daysAgo);
  }
  
  // Additional filters
  if (area_id) {
    query += " AND t.area_id = ?";
    params.push(area_id);
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
    query += " ORDER BY CASE t.status WHEN 'in_progress' THEN 1 WHEN 'todo' THEN 2 WHEN 'paused' THEN 3 WHEN 'done' THEN 4 END, ";
    query += " CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 END, ";
    query += " t.last_modified DESC";
  } else if (view === 'tracker') {
    query += " ORDER BY a.name, CASE t.status WHEN 'done' THEN 1 WHEN 'paused' THEN 2 WHEN 'todo' THEN 3 WHEN 'in_progress' THEN 4 END, ";
    query += " t.last_modified DESC";
  } else {
    query += " ORDER BY t.last_modified DESC";
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
  const { title, description, area_id, parent_task_id, priority, due_date } = req.body;
  
  if (!title) {
    res.status(400).json({ error: 'Task title is required' });
    return;
  }
  
  // Check if due date is tomorrow and set priority to urgent
  let finalPriority = priority || 'normal';
  if (due_date && moment(due_date).format('YYYY-MM-DD') === getNextBusinessDay()) {
    finalPriority = 'urgent';
  }
  
  db.run(`
    INSERT INTO tasks (title, description, area_id, parent_task_id, priority, due_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [title, description, area_id, parent_task_id, finalPriority, due_date], async function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const taskId = this.lastID;
    await addTaskHistory(taskId, 'todo', 'Task created');
    
    // Update parent task status if this is a sub-task
    if (parent_task_id) {
      await updateParentTaskStatus(parent_task_id);
    }
    
    res.json({ id: taskId, title, status: 'todo', priority: finalPriority });
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
      updateFields.push('start_date = CURRENT_TIMESTAMP');
    } else if (status === 'done' && currentTask.status !== 'done') {
      updateFields.push('completion_date = CURRENT_TIMESTAMP');
    }
    
    updateFields.push('last_modified = CURRENT_TIMESTAMP');
    
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
  const { title, description, area_id, priority, due_date } = req.body;
  
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
    
    // Check if due date is tomorrow and set priority to urgent
    let finalPriority = priority || currentTask.priority;
    if (due_date && moment(due_date).format('YYYY-MM-DD') === getNextBusinessDay()) {
      finalPriority = 'urgent';
    }
    
    await new Promise((resolve, reject) => {
      db.run(`
        UPDATE tasks 
        SET title = ?, description = ?, area_id = ?, priority = ?, due_date = ?, last_modified = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [title, description, area_id, finalPriority, due_date, id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
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
      a.name as area,
      t.status,
      t.priority,
      t.due_date,
      t.start_date,
      t.completion_date,
      t.last_modified,
      t.created_at,
      (SELECT COUNT(*) FROM tasks WHERE parent_task_id = t.id) as sub_task_count
    FROM tasks t
    LEFT JOIN areas a ON t.area_id = a.id
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 