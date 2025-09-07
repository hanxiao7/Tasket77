// Load environment variables from .env file
require('dotenv').config();

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
const { testEmailConfig } = require('./services/emailService');
const { createDefaultPresetFilters, createExampleTasks } = require('./services/workspaceInit');
const authRoutes = require('./routes/auth');
const workspacePermissionsRoutes = require('./routes/workspace-permissions');

const app = express();
const PORT = process.env.PORT || 3001;

// Database Query Caching for Filter Definitions
const filterCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Removed excessive debug logging

// Cache utility functions
function getCacheKey(filterIds) {
  return filterIds.sort().join(',');
}

function getCachedFilters(filterIds) {
  const cacheKey = getCacheKey(filterIds);
  const cached = filterCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  return null;
}

function setCachedFilters(filterIds, data) {
  const cacheKey = getCacheKey(filterIds);
  filterCache.set(cacheKey, { 
    data, 
    timestamp: Date.now() 
  });
}

function clearFilterCache() {
  filterCache.clear();
}

// Cache statistics for monitoring
function getCacheStats() {
  const now = Date.now();
  let hits = 0;
  let misses = 0;
  let expired = 0;
  
  for (const [key, value] of filterCache.entries()) {
    if (now - value.timestamp < CACHE_TTL) {
      hits++;
    } else {
      expired++;
    }
  }
  
  return {
    totalEntries: filterCache.size,
    hits,
    misses,
    expired,
    hitRate: filterCache.size > 0 ? (hits / filterCache.size * 100).toFixed(2) + '%' : '0%'
  };
}

// Periodic cache cleanup to remove expired entries
function cleanupExpiredCache() {
  const now = Date.now();
  let removedCount = 0;
  
  for (const [key, value] of filterCache.entries()) {
    if (now - value.timestamp >= CACHE_TTL) {
      filterCache.delete(key);
      removedCount++;
    }
  }
  
  // Cache cleanup runs silently
}

// Run cache cleanup every 10 minutes
setInterval(cleanupExpiredCache, 10 * 60 * 1000);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? true // Allow all origins in production for now
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
    console.log('✅ Database initialized successfully');
    
    // Test email configuration
    await testEmailConfig();
    
    // Check if backup is needed (only if more than 12 hours since last backup)
    const backupManager = new PostgreSQLBackupManager();
    const lastMetadata = backupManager.getLastBackupMetadata();
    
    let shouldBackup = true;
    let backupReason = 'No previous backup found';
    
    if (lastMetadata && lastMetadata.lastBackup) {
      const lastBackupTime = new Date(lastMetadata.lastBackup);
      const now = new Date();
      const hoursSinceLastBackup = (now - lastBackupTime) / (1000 * 60 * 60);
      
      if (hoursSinceLastBackup < 12) {
        shouldBackup = false;
        backupReason = `Recent backup exists (${Math.round(hoursSinceLastBackup)} hours ago)`;
      } else {
        backupReason = `Last backup was ${Math.round(hoursSinceLastBackup)} hours ago`;
      }
    }
    
    if (shouldBackup) {
      // Perform automatic backup with change detection
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
    } else {
      console.log(`Backup skipped: ${backupReason}`);
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

// Simple health check endpoint
app.get('/api/health', (req, res) => {
  const cacheStats = getCacheStats();
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    cache: cacheStats
  });
});

// Get all categories
app.get('/api/categories', authenticateToken, async (req, res) => {
  const { include_hidden, workspace_id } = req.query;
  // console.log(`🔍 Fetching categories for user ${req.user.userId}, workspace_id: ${workspace_id}, include_hidden: ${include_hidden}`);
  
  let query = `
    SELECT c.* 
    FROM categories c
    INNER JOIN workspace_permissions wp ON c.workspace_id = wp.workspace_id
    WHERE wp.user_id = $1
  `;
  const params = [req.user.userId];
  let paramIndex = 2;
  
  if (include_hidden !== 'true') {
    query += ` AND c.hidden = false`;
  }
  if (workspace_id) {
    query += ` AND c.workspace_id = $${paramIndex}`;
    params.push(workspace_id);
    paramIndex++;
  }
  
  query += ' ORDER BY c.name';
  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new category
app.post('/api/categories', authenticateToken, async (req, res) => {
  const { name, workspace_id } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Category name is required' });
    return;
  }
  if (!workspace_id) {
    res.status(400).json({ error: 'Workspace ID is required' });
    return;
  }
  try {
    const now = moment().utc().format('YYYY-MM-DD HH:mm:ss');
    const result = await pool.query(
      'INSERT INTO categories (name, workspace_id, user_id, hidden, created_at, updated_at) VALUES ($1, $2, $3, false, $4, $4) RETURNING *',
      [name, workspace_id, req.user.userId, now]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update category
app.put('/api/categories/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Category name is required' });
    return;
  }
  try {
    const now = moment().utc().format('YYYY-MM-DD HH:mm:ss');
    const updateResult = await pool.query(
      'UPDATE categories SET name = $1, updated_at = $2 WHERE id = $3 AND user_id = $4 RETURNING *',
      [name, now, id, req.user.userId]
    );
    if (updateResult.rowCount === 0) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    res.json(updateResult.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle category hidden status
app.patch('/api/categories/:id/toggle-hidden', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const now = moment().utc().format('YYYY-MM-DD HH:mm:ss');
    const updateResult = await pool.query(
      'UPDATE categories SET hidden = NOT hidden, updated_at = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [now, id, req.user.userId]
    );
    if (updateResult.rowCount === 0) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    res.json(updateResult.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete category
app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE tasks SET category_id = NULL WHERE category_id = $1', [id]);
    const deleteResult = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING *', [id]);
    if (deleteResult.rowCount === 0) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all tags
app.get('/api/tags', authenticateToken, async (req, res) => {
  const { workspace_id } = req.query;
  // console.log(`🔍 Fetching tags for user ${req.user.userId}, workspace_id: ${workspace_id}`);
  
  let query = `
    SELECT t.* 
    FROM tags t
    INNER JOIN workspace_permissions wp ON t.workspace_id = wp.workspace_id
    WHERE wp.user_id = $1
  `;
  const params = [req.user.userId];
  let paramIndex = 2;
  
  if (workspace_id) {
    query += ` AND t.workspace_id = $${paramIndex}`;
    params.push(workspace_id);
    paramIndex++;
  }
  
  query += ' ORDER BY (SELECT COUNT(*) FROM tasks WHERE tag_id = t.id) DESC, t.created_at DESC';
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

// Helper function to build preset filter conditions
// New dynamic filter query builder using the new database structure
async function buildFilterQueryFromDatabase(filterIds, startParamIndex, params, userId, currentDays, customFilters = []) {
  if ((!filterIds || filterIds.length === 0) && (!customFilters || customFilters.length === 0)) {
    return null;
  }

  // Field mapping utilities to reduce code duplication
  const getFieldMapping = (field) => {
    const fieldMap = {
      due_date: 't.due_date',
      completion_date: 't.completion_date',
      created_date: 't.created_at',
      last_modified: 't.last_modified',
      start_date: 't.start_date',
      today: 'CURRENT_DATE'
    };
    return fieldMap[field] || `t.${field}`;
  };

  const getFieldColumn = (field) => {
    const columnMap = {
      category: 'category_id',
      tag: 'tag_id',
      assignee: 'task_assignees' // Special case for EXISTS queries
    };
    return columnMap[field] || field;
  };

  const buildFieldCondition = (field, operator, values, paramBuilder) => {
    if (field === 'assignee') {
      if (operator === '=' && values[0] === 'current_user_id') {
        return {
          query: `EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ${paramBuilder.add(userId)})`,
          params: []
        };
      } else if (operator === 'IN') {
        return {
          query: `EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ANY(${paramBuilder.addArray(values)}))`,
          params: []
        };
      } else if (operator === 'IS_NULL') {
        return {
          query: `NOT EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id)`,
          params: []
        };
      } else if (operator === 'IS_NOT_NULL') {
        return {
          query: `EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id)`,
          params: []
        };
      }
    } else if (field === 'category' || field === 'tag') {
      const column = getFieldColumn(field);
      if (operator === '=') {
        return {
          query: `t.${column} = ${paramBuilder.add(values[0])}`,
          params: []
        };
      } else if (operator === '!=') {
        return {
          query: `t.${column} != ${paramBuilder.add(values[0])}`,
          params: []
        };
      } else if (operator === 'IN') {
        return {
          query: `t.${column} = ANY(${paramBuilder.addArray(values)})`,
          params: []
        };
      } else if (operator === 'IS_NULL') {
        return {
          query: `t.${column} IS NULL`,
          params: []
        };
      } else if (operator === 'IS_NOT_NULL') {
        return {
          query: `t.${column} IS NOT NULL`,
          params: []
        };
      }
    } else {
      // Direct field access
      if (operator === '=') {
        return {
          query: `t.${field} = ${paramBuilder.add(values[0])}`,
          params: []
        };
      } else if (operator === '!=') {
        return {
          query: `t.${field} != ${paramBuilder.add(values[0])}`,
          params: []
        };
      } else if (operator === 'IN') {
        return {
          query: `t.${field} = ANY(${paramBuilder.addArray(values)})`,
          params: []
        };
      } else if (operator === 'IS_NULL') {
        return {
          query: `t.${field} IS NULL`,
          params: []
        };
      } else if (operator === 'IS_NOT_NULL') {
        return {
          query: `t.${field} IS NOT NULL`,
          params: []
        };
      }
    }
    
    return null;
  };

  // Parameter builder utility for safer SQL construction
  class ParameterBuilder {
    constructor(startIndex = 1) {
      this.index = startIndex;
      this.params = [];
    }
    
    add(value) {
      this.params.push(value);
      return `$${this.index++}`;
    }
    
    addArray(values) {
      this.params.push(values);
      return `$${this.index++}`;
    }
    
    getParams() {
      return this.params;
    }
    
    getCurrentIndex() {
      return this.index;
    }
  }

  try {
    // Check cache first
    const cachedData = getCachedFilters(filterIds);
    let result;
    
    if (cachedData) {
      result = cachedData;
    } else {
      // Get filter conditions from database
      const query = `
        SELECT 
          fp.id,
          fp.name,
          fp.operator,
          fc.condition_type,
          fc.field,
          fc.date_from,
          fc.date_to,
          fc.operator as condition_operator,
          fc.values,
          fc.unit
        FROM filter_preferences fp
        LEFT JOIN filter_conditions fc ON fp.id = fc.filter_id
        WHERE fp.id = ANY($1)
        ORDER BY fp.id, fc.id
      `;
      
      const dbResult = await pool.query(query, [filterIds]);
      result = dbResult;
      
      // Cache the result
      setCachedFilters(filterIds, result);
      
    }
    
    if (result.rows.length === 0) {
      return null;
    }

    // Group conditions by filter
    const filtersMap = new Map();
    result.rows.forEach(row => {
      if (!filtersMap.has(row.id)) {
        filtersMap.set(row.id, {
          id: row.id,
          name: row.name,
          operator: row.operator,
          conditions: []
        });
      }
      
      if (row.condition_type) {
        filtersMap.get(row.id).conditions.push({
          condition_type: row.condition_type,
          field: row.field,
          date_from: row.date_from,
          date_to: row.date_to,
          operator: row.condition_operator,
          values: row.values,
          unit: row.unit
        });
      }
    });

    // Build query conditions using ParameterBuilder
    const allConditions = [];
    const paramBuilder = new ParameterBuilder(startParamIndex);

    for (const [filterId, filter] of filtersMap) {
      const filterConditions = [];
      
      for (const condition of filter.conditions) {
        let conditionQuery = '';
        
        if (condition.condition_type === 'list') {
          // Use the utility function to build field conditions
          const fieldCondition = buildFieldCondition(condition.field, condition.operator, condition.values, paramBuilder);
          if (fieldCondition) {
            conditionQuery = fieldCondition.query;
          }
        } else if (condition.condition_type === 'date_diff') {
          // Handle date difference conditions using date_from and date_to
          const dateFrom = getFieldMapping(condition.date_from);
          const dateTo = getFieldMapping(condition.date_to);
          
          // Use currentDays if available, otherwise use default values
          let daysValue = condition.values && condition.values.length > 0 ? condition.values[0] : 7;
          
          // Convert filter name to key format (same as frontend)
          const key = filter.name.toLowerCase().replace(/\s+/g, '_');
          
          if (currentDays && currentDays[key]) {
            daysValue = currentDays[key];
          }
          
          // Always use: date_to - date_from [operator] [days]
          conditionQuery = `((${dateTo})::date - (${dateFrom})::date) ${condition.operator} ${paramBuilder.add(daysValue)}`;
        }
        
        if (conditionQuery) {
          filterConditions.push(conditionQuery);
        }
      }
      
      if (filterConditions.length > 0) {
        const filterQuery = filterConditions.join(` ${filter.operator} `);
        allConditions.push(`(${filterQuery})`);
      }
    }

    // Process custom filters using ParameterBuilder
    for (const customFilter of customFilters) {
      const customFilterConditions = [];
      
      for (const condition of customFilter.conditions) {
        let conditionQuery = '';
        
        if (condition.condition_type === 'list') {
          // Use the utility function to build field conditions
          const fieldCondition = buildFieldCondition(condition.field, condition.operator, condition.values, paramBuilder);
          if (fieldCondition) {
            conditionQuery = fieldCondition.query;
          }
        } else if (condition.condition_type === 'date_diff') {
          const dateFrom = getFieldMapping(condition.date_from);
          const dateTo = getFieldMapping(condition.date_to);
          
          conditionQuery = `((${dateTo})::date - (${dateFrom})::date) ${condition.operator} ${paramBuilder.add(condition.values[0])}`;
        } else if (condition.condition_type === 'date_range') {
          conditionQuery = `t.${condition.field} BETWEEN ${paramBuilder.add(condition.values[0])} AND ${paramBuilder.add(condition.values[1])}`;
        }
        
        if (conditionQuery) {
          customFilterConditions.push(conditionQuery);
        }
      }
      
      if (customFilterConditions.length > 0) {
        const customFilterQuery = customFilterConditions.join(` ${customFilter.logic} `);
        allConditions.push(`(${customFilterQuery})`);
      }
    }

    // Each filter should be independent - they're already combined with their own operators
    // So we just need to join them with AND (since multiple enabled filters should all apply)
    const finalQuery = allConditions.length > 0 ? allConditions.join(' AND ') : null;
    
    // Add the ParameterBuilder's parameters to the main params array
    params.push(...paramBuilder.getParams());
    
    return finalQuery;
    
  } catch (error) {
    console.error('Error building filter query from database:', error);
    return null;
  }
}

// Removed buildPresetFilterCondition function - no longer needed with new filter system

// Get tasks with optional filters
app.get('/api/tasks', authenticateToken, async (req, res) => {
  const { view, presets, workspace_id, customFilters, customFiltersLogic, currentDays } = req.query;
  let query = `
    SELECT t.*, c.name as category_name, tg.name as tag_name,
           COALESCE(
             (SELECT ARRAY_AGG(DISTINCT u.name) 
              FROM task_assignees ta2 
              JOIN users u ON ta2.user_id = u.id 
              WHERE ta2.task_id = t.id), 
             ARRAY[]::text[]
           ) as assignee_names,
           COALESCE(
             (SELECT ARRAY_AGG(DISTINCT u.email) 
              FROM task_assignees ta2 
              JOIN users u ON ta2.user_id = u.id 
              WHERE ta2.task_id = t.id), 
             ARRAY[]::text[]
           ) as assignee_emails
    FROM tasks t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN tags tg ON t.tag_id = tg.id
    INNER JOIN workspace_permissions wp ON t.workspace_id = wp.workspace_id
    WHERE wp.user_id = $1
  `;
  const params = [req.user.userId];
  let paramIndex = 2;
  
  if (workspace_id) {
    query += ` AND t.workspace_id = $${paramIndex}`;
    params.push(workspace_id);
    paramIndex++;
  }

  // Apply preset filters
  if (presets) {
    try {
      const presetArray = JSON.parse(presets);
      if (Array.isArray(presetArray) && presetArray.length > 0) {
        // Parse currentDays if provided
        let frontendDays = {};
        if (currentDays) {
          try {
            frontendDays = JSON.parse(currentDays);
          } catch (e) {
            // Use database values if parsing fails
          }
        }
        
        // Use new dynamic filter system for both preset and custom filters
        let customFiltersArray = [];
        if (customFilters) {
          try {
            customFiltersArray = JSON.parse(customFilters);
          } catch (e) {
            console.error('Error parsing custom filters:', e);
          }
        }
        
        if (presetArray && presetArray.length > 0 || customFiltersArray && customFiltersArray.length > 0) {
          const dynamicCondition = await buildFilterQueryFromDatabase(presetArray, paramIndex, params, req.user.userId, frontendDays, customFiltersArray);
          if (dynamicCondition) {
            query += ` AND (${dynamicCondition})`;
          }
        }
      }
    } catch (e) {
      console.error('Error parsing presets:', e);
    }
  }

  // Custom filters are now handled in the unified buildFilterQueryFromDatabase function above
  if (view === 'planner') {
    query += ' ORDER BY CASE t.status WHEN \'in_progress\' THEN 1 WHEN \'paused\' THEN 2 WHEN \'todo\' THEN 3 WHEN \'done\' THEN 4 END,';
    query += ' CASE t.priority WHEN \'urgent\' THEN 1 WHEN \'high\' THEN 2 WHEN \'normal\' THEN 3 WHEN \'low\' THEN 4 END,';
    query += ' t.title ASC';
  } else if (view === 'tracker') {
    query += ' ORDER BY c.name, CASE t.status WHEN \'done\' THEN 1 WHEN \'in_progress\' THEN 2 WHEN \'paused\' THEN 3 WHEN \'todo\' THEN 4 END,';
    query += ' t.title ASC';
  } else {
    query += ' ORDER BY t.title ASC';
  }
  try {
    const result = await pool.query(query, params);
    // Check and update priorities for tasks due tomorrow or earlier (only if there are tasks to update)
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
      return taskDate <= nextBusinessDay;
    });
    
    // Only update if there are tasks that need updating
    if (tasksToUpdate.length > 0) {
      // Use a single batch update instead of individual queries
      const taskIds = tasksToUpdate.map(task => task.id);
      await pool.query(
        'UPDATE tasks SET priority = $1 WHERE id = ANY($2) AND user_id = $3',
        ['urgent', taskIds, req.user.userId]
      );
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new task
app.post('/api/tasks', authenticateToken, async (req, res) => {
  const { title, description, category_id, tag_id, priority, due_date, workspace_id } = req.body;
  
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
  
  // Check if due date is on or before next business day and set priority to urgent
  let finalPriority = priority || 'normal';
  const nextBusinessDay = getNextBusinessDay();
  if (parsedDueDate && parsedDueDate <= nextBusinessDay) {
    finalPriority = 'urgent';
  }
  
  try {
    const now = moment().utc().format('YYYY-MM-DD HH:mm:ss');
    const result = await pool.query(
      `
    INSERT INTO tasks (user_id, workspace_id, title, description, category_id, tag_id, priority, due_date, created_at, last_modified)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
    RETURNING *
  `, [req.user.userId, workspace_id, title, description, category_id, tag_id, finalPriority, parsedDueDate, now]
    );
    
    const taskId = result.rows[0].id;
    
    // Auto-assign the task creator as assignee
    await pool.query(
      `
      INSERT INTO task_assignees (task_id, user_id, assigned_by, assigned_at)
      VALUES ($1, $2, $3, $4)
      `,
      [taskId, req.user.userId, req.user.userId, now]
    );
    
    await addTaskHistory(taskId, 'todo', 'Task created');
    
    // Get the complete task information including category, tag, and assignee details
    const fullRowResult = await pool.query(
      `
      SELECT t.*, c.name as category_name, tg.name as tag_name,
             ARRAY_AGG(DISTINCT u.name) as assignee_names,
             ARRAY_AGG(DISTINCT u.email) as assignee_emails
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN tags tg ON t.tag_id = tg.id
      LEFT JOIN task_assignees ta ON t.id = ta.task_id
      LEFT JOIN users u ON ta.user_id = u.id
      WHERE t.id = $1
      GROUP BY t.id, c.name, tg.name
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
  const { title, description, category_id, tag_id, priority, status, start_date, due_date, completion_date } = req.body;

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
    if (category_id !== undefined) {
      updateFields.push(`category_id = $${paramIndex}`);
      updateParams.push(category_id);
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
      // Check if due date is on or before next business day and set priority to urgent
      const nextBusinessDay = getNextBusinessDay();
      if (due_date && due_date <= nextBusinessDay) {
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

// Task assignee endpoints (must come before /api/tasks/:id to avoid route conflicts)
app.get('/api/tasks/:id/assignees', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  // console.log(`🔍 Task assignees request: task_id=${id}, user_id=${req.user.userId}`);
  
  try {
    // Check if user has access to the task's workspace
    const taskResult = await pool.query(
      'SELECT workspace_id FROM tasks WHERE id = $1',
      [id]
    );
    
    // console.log(`📋 Task lookup result: ${taskResult.rowCount} rows found`);
    
    if (taskResult.rowCount === 0) {
      console.log(`❌ Task ${id} not found`);
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    
    const workspaceId = taskResult.rows[0].workspace_id;
    // console.log(`🏢 Task ${id} belongs to workspace ${workspaceId}`);
    
    // Check workspace access (any access level can view assignees)
    const accessResult = await pool.query(
      'SELECT access_level FROM workspace_permissions WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, req.user.userId]
    );
    
    // console.log(`📋 Workspace access check: ${accessResult.rowCount} rows found`);
    
    if (accessResult.rowCount === 0) {
      console.log(`❌ Access denied for user ${req.user.userId} to workspace ${workspaceId}`);
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    
    // Get assignees with user details
    const assigneesResult = await pool.query(
      `
      SELECT ta.*, u.name as user_name, u.email as user_email
      FROM task_assignees ta
      JOIN users u ON ta.user_id = u.id
      WHERE ta.task_id = $1
      ORDER BY ta.assigned_at ASC
      `,
      [id]
    );
    
    // console.log(`👥 Found ${assigneesResult.rows.length} assignees for task ${id}`);
    res.json(assigneesResult.rows);
  } catch (err) {
    console.error(`❌ Error in task assignees endpoint:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Add assignee to task
app.post('/api/tasks/:id/assignees', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;
  
  if (!user_id) {
    res.status(400).json({ error: 'User ID is required' });
    return;
  }
  
  try {
    // Check if user has edit access to the task's workspace
    const taskResult = await pool.query(
      'SELECT workspace_id FROM tasks WHERE id = $1',
      [id]
    );
    
    if (taskResult.rowCount === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    
    const workspaceId = taskResult.rows[0].workspace_id;
    
    // Check workspace access (edit or owner level required)
    const accessResult = await pool.query(
      'SELECT access_level FROM workspace_permissions WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, req.user.userId]
    );
    
    if (accessResult.rowCount === 0 || !['edit', 'owner'].includes(accessResult.rows[0].access_level)) {
      res.status(403).json({ error: 'Edit access required' });
      return;
    }
    
    // Check if target user has access to the workspace
    const targetAccessResult = await pool.query(
      'SELECT access_level FROM workspace_permissions WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, user_id]
    );
    
    if (targetAccessResult.rowCount === 0) {
      res.status(400).json({ error: 'Target user does not have access to this workspace' });
      return;
    }
    
    // Check if assignment already exists
    const existingResult = await pool.query(
      'SELECT id FROM task_assignees WHERE task_id = $1 AND user_id = $2',
      [id, user_id]
    );
    
    if (existingResult.rowCount > 0) {
      res.status(400).json({ error: 'User is already assigned to this task' });
      return;
    }
    
    // Add assignment
    const result = await pool.query(
      `
      INSERT INTO task_assignees (task_id, user_id, assigned_by, assigned_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      RETURNING *
      `,
      [id, user_id, req.user.userId]
    );
    
    // Get the complete assignment with user details
    const fullResult = await pool.query(
      `
      SELECT ta.*, u.name as user_name, u.email as user_email
      FROM task_assignees ta
      JOIN users u ON ta.user_id = u.id
      WHERE ta.id = $1
      `,
      [result.rows[0].id]
    );
    
    res.json(fullResult.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove assignee from task
app.delete('/api/tasks/:id/assignees/:user_id', authenticateToken, async (req, res) => {
  const { id, user_id } = req.params;
  
  try {
    // Check if user has edit access to the task's workspace
    const taskResult = await pool.query(
      'SELECT workspace_id FROM tasks WHERE id = $1',
      [id]
    );
    
    if (taskResult.rowCount === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    
    const workspaceId = taskResult.rows[0].workspace_id;
    
    // Check workspace access (edit or owner level required)
    const accessResult = await pool.query(
      'SELECT access_level FROM workspace_permissions WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, req.user.userId]
    );
    
    if (accessResult.rowCount === 0 || !['edit', 'owner'].includes(accessResult.rows[0].access_level)) {
      res.status(403).json({ error: 'Edit access required' });
      return;
    }
    
    // Remove assignment
    const result = await pool.query(
      'DELETE FROM task_assignees WHERE task_id = $1 AND user_id = $2 RETURNING *',
      [id, user_id]
    );
    
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get workspace users for assignment
app.get('/api/workspace-users/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  // console.log(`🔍 Workspace users request: workspace_id=${id}, user_id=${req.user.userId}`);
  
  try {
    // Check if user has access to the workspace
    const accessResult = await pool.query(
      'SELECT access_level FROM workspace_permissions WHERE workspace_id = $1 AND user_id = $2',
      [id, req.user.userId]
    );
    
    // console.log(`📋 Access check result: ${accessResult.rowCount} rows found`);
    
    if (accessResult.rowCount === 0) {
      console.log(`❌ Access denied for user ${req.user.userId} to workspace ${id}`);
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    
    // Get all users with access to this workspace
    const usersResult = await pool.query(
      `
      SELECT wp.user_id, u.name, u.email, wp.access_level
      FROM workspace_permissions wp
      JOIN users u ON wp.user_id = u.id
      WHERE wp.workspace_id = $1
      ORDER BY u.name ASC
      `,
      [id]
    );
    
    // console.log(`👥 Found ${usersResult.rows.length} users for workspace ${id}`);
    res.json(usersResult.rows);
  } catch (err) {
    console.error(`❌ Error in workspace users endpoint:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Removed user-preferences endpoints - no longer needed with new filter system

// Cache management endpoints
app.get('/api/cache/stats', authenticateToken, async (req, res) => {
  try {
    const stats = getCacheStats();

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cache/clear', authenticateToken, async (req, res) => {
  try {
    clearFilterCache();
    res.json({ success: true, message: 'Filter cache cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get filters for a workspace and view mode
app.get('/api/filters/:workspaceId', authenticateToken, async (req, res) => {
  const { workspaceId } = req.params;
  const { view_mode } = req.query;
  const userId = req.user.userId;
  
  try {
    // Check if user has access to the workspace
    const accessResult = await pool.query(
      'SELECT access_level FROM workspace_permissions WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, userId]
    );
    
    if (accessResult.rowCount === 0) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    
    // Query filter_preferences with conditions
    const query = `
      SELECT 
        fp.id,
        fp.name,
        fp.view_mode,
        fp.operator,
        fp.is_default,
        fp.created_at,
        fc.id as condition_id,
        fc.condition_type,
        fc.field,
        fc.date_from,
        fc.date_to,
        fc.operator as condition_operator,
        fc.values,
        fc.unit
      FROM filter_preferences fp
      LEFT JOIN filter_conditions fc ON fp.id = fc.filter_id
      WHERE fp.user_id = $1 
        AND fp.workspace_id = $2 
        AND fp.view_mode = $3
      ORDER BY fp.id, fc.id
    `;
    
    const result = await pool.query(query, [userId, workspaceId, view_mode]);
    
    // Group conditions by filter
    const filtersMap = new Map();
    
    result.rows.forEach(row => {
      if (!filtersMap.has(row.id)) {
        filtersMap.set(row.id, {
          id: row.id,
          name: row.name,
          view_mode: row.view_mode,
          operator: row.operator,
          is_default: row.is_default,
          created_at: row.created_at,
          conditions: []
        });
      }
      
      if (row.condition_id) {
        filtersMap.get(row.id).conditions.push({
          id: row.condition_id,
          condition_type: row.condition_type,
          field: row.field,
          date_from: row.date_from,
          date_to: row.date_to,
          operator: row.condition_operator,
          values: row.values,
          unit: row.unit
        });
      }
    });
    
    const filters = Array.from(filtersMap.values());
    res.json(filters);
    
  } catch (err) {
    console.error(`❌ Error in filters endpoint:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Get single task
app.get('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  
  pool.query(`
    SELECT t.*, c.name as category_name,
           COALESCE(
             (SELECT ARRAY_AGG(DISTINCT u.name) 
              FROM task_assignees ta2 
              JOIN users u ON ta2.user_id = u.id 
              WHERE ta2.task_id = t.id), 
             ARRAY[]::text[]
           ) as assignee_names,
           COALESCE(
             (SELECT ARRAY_AGG(DISTINCT u.email) 
              FROM task_assignees ta2 
              JOIN users u ON ta2.user_id = u.id 
              WHERE ta2.task_id = t.id), 
             ARRAY[]::text[]
           ) as assignee_emails
    FROM tasks t
    LEFT JOIN categories c ON t.category_id = c.id
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
    const categories = await client.query('SELECT * FROM categories ORDER BY id');
    const tasks = await client.query('SELECT * FROM tasks ORDER BY id');
    const taskHistory = await client.query('SELECT * FROM task_history ORDER BY id');
    
    const exportData = {
      exportDate: new Date().toISOString(),
      version: '2.0',
      workspaces: workspaces.rows,
      categories: categories.rows,
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
      await client.query('DELETE FROM categories');
      await client.query('DELETE FROM workspaces');
      
      // Import workspaces
      if (importData.workspaces && importData.workspaces.length > 0) {
        for (const workspace of importData.workspaces) {
          await client.query(`
            INSERT INTO workspaces (id, name, description, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              description = EXCLUDED.description,
              updated_at = EXCLUDED.updated_at
          `, [
            workspace.id,
            workspace.name,
            workspace.description,
            workspace.created_at,
            workspace.updated_at
          ]);
        }
      }
      
      // Import categories
      if (importData.categories && importData.categories.length > 0) {
        for (const category of importData.categories) {
          await client.query(`
            INSERT INTO categories (id, name, workspace_id, hidden, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              workspace_id = EXCLUDED.workspace_id,
              hidden = EXCLUDED.hidden,
              updated_at = EXCLUDED.updated_at
          `, [
            category.id,
            category.name,
            category.workspace_id,
            category.hidden,
            category.created_at,
            category.updated_at
          ]);
        }
      }
      
      // Import tasks
      if (importData.tasks && importData.tasks.length > 0) {
        for (const task of importData.tasks) {
          await client.query(`
            INSERT INTO tasks (id, user_id, workspace_id, title, description, category_id, priority, status, due_date, start_date, completion_date, last_modified, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (id) DO UPDATE SET
              user_id = EXCLUDED.user_id,
              workspace_id = EXCLUDED.workspace_id,
              title = EXCLUDED.title,
              description = EXCLUDED.description,
              category_id = EXCLUDED.category_id,
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
            task.category_id,
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
          categories: importData.categories?.length || 0,
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

// Get all workspaces (including shared ones)
app.get('/api/workspaces', authenticateToken, async (req, res) => {
  try {
    // console.log(`🔍 Fetching workspaces for user ${req.user.userId}`);
    const result = await pool.query(`
      SELECT 
        wp.workspace_id as id,
        w.name,
        w.description,
        wp.access_level,
        wp.is_default,
        w.created_at,
        w.updated_at,
        (
          SELECT COUNT(*) 
          FROM workspace_permissions wp2 
          WHERE wp2.workspace_id = wp.workspace_id 
          AND wp2.user_id != $1
        ) as other_users_count
      FROM workspace_permissions wp
      INNER JOIN workspaces w ON wp.workspace_id = w.id
      WHERE wp.user_id = $1
      ORDER BY wp.is_default DESC, w.name
    `, [req.user.userId]);
    // console.log(`📋 Found ${result.rows.length} workspaces for user ${req.user.userId}`);
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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Create workspace
    const result = await client.query(
      'INSERT INTO workspaces (name, description, user_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $4) RETURNING *',
      [name, description || '', req.user.userId, now]
    );
    
    // Get user email for the permission record
    const userResult = await client.query(
      'SELECT email FROM users WHERE id = $1',
      [req.user.userId]
    );
    
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }
    
    // Add owner permission with is_default = true for the first workspace
    const existingWorkspacesResult = await client.query(
      'SELECT COUNT(*) FROM workspace_permissions WHERE user_id = $1',
      [req.user.userId]
    );
    
    const isFirstWorkspace = parseInt(existingWorkspacesResult.rows[0].count) === 0;
    
    await client.query(
      'INSERT INTO workspace_permissions (workspace_id, user_id, email, access_level, is_default) VALUES ($1, $2, $3, $4, $5)',
      [result.rows[0].id, req.user.userId, userResult.rows[0].email, 'owner', isFirstWorkspace]
    );
    
    await client.query('COMMIT');
    
    // Create default preset filters for the creator
    await createDefaultPresetFilters(client, req.user.userId, result.rows[0].id);
    
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
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
  
  const client = await pool.connect();
  try {
    // Check if user has owner access to this workspace
    const permissionResult = await client.query(
      'SELECT access_level FROM workspace_permissions WHERE workspace_id = $1 AND user_id = $2',
      [id, req.user.userId]
    );
    
    if (permissionResult.rowCount === 0) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }
    
    if (permissionResult.rows[0].access_level !== 'owner') {
      res.status(403).json({ error: 'Only owners can update workspaces' });
      return;
    }
    
    const now = moment().utc().format('YYYY-MM-DD HH:mm:ss');
    const updateResult = await client.query(
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
  } finally {
    client.release();
  }
});

// Delete workspace
app.delete('/api/workspaces/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    // Check if user has owner access to this workspace
    const permissionResult = await client.query(
      'SELECT access_level FROM workspace_permissions WHERE workspace_id = $1 AND user_id = $2',
      [id, req.user.userId]
    );
    
    if (permissionResult.rowCount === 0) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }
    
    if (permissionResult.rows[0].access_level !== 'owner') {
      res.status(403).json({ error: 'Only owners can delete workspaces' });
      return;
    }
    
    // Check if this workspace is the default for the current user
    const checkResult = await client.query('SELECT is_default FROM workspace_permissions WHERE workspace_id = $1 AND user_id = $2', [id, req.user.userId]);
    if (checkResult.rows[0].is_default) {
      res.status(400).json({ error: 'Cannot delete the default workspace' });
      return;
    }
    
    // Check if other users have access to this workspace
    const otherUsersResult = await client.query(
      'SELECT COUNT(*) FROM workspace_permissions WHERE workspace_id = $1 AND user_id != $2',
      [id, req.user.userId]
    );
    
    if (parseInt(otherUsersResult.rows[0].count) > 0) {
      res.status(400).json({ error: 'Cannot delete workspace when other users have access' });
      return;
    }
    
    await client.query('BEGIN');
    
    // Delete all related data
    await client.query('DELETE FROM tasks WHERE workspace_id = $1', [id]);
    await client.query('DELETE FROM categories WHERE workspace_id = $1', [id]);
    await client.query('DELETE FROM tags WHERE workspace_id = $1', [id]);
    await client.query('DELETE FROM workspace_permissions WHERE workspace_id = $1', [id]);
    const deleteResult = await client.query('DELETE FROM workspaces WHERE id = $1 RETURNING *', [id]);
    
    await client.query('COMMIT');
    
    if (deleteResult.rowCount === 0) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Set workspace as default
app.patch('/api/workspaces/:id/set-default', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    // console.log(`🔧 Setting workspace ${id} as default for user ${req.user.userId}`);
    
    // Check if user has access to this workspace
    const accessResult = await client.query(
      'SELECT access_level FROM workspace_permissions WHERE workspace_id = $1 AND user_id = $2',
      [id, req.user.userId]
    );
    
    if (accessResult.rowCount === 0) {
      res.status(404).json({ error: 'Workspace not found or you do not have access' });
      return;
    }
    
    // First, unset all default workspaces for the current user
    await client.query(
      'UPDATE workspace_permissions SET is_default = false WHERE user_id = $1',
      [req.user.userId]
    );
    
    // Then set the target workspace as default
    const updateResult = await client.query(
      'UPDATE workspace_permissions SET is_default = true WHERE workspace_id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.userId]
    );
    
    // console.log(`✅ Successfully set workspace ${id} as default for user ${req.user.userId}`);
    res.json({ success: true, workspace_id: id });
  } catch (err) {
    console.error('Error setting default workspace:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Authentication routes (no auth required)
app.use('/api/auth', authRoutes);

// Workspace permissions routes
app.use('/api', workspacePermissionsRoutes);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
