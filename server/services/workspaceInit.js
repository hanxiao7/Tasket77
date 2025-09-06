// Utility functions for filter management
const moment = require('moment-timezone');

// Helper function to create default preset filters for a user in a workspace
async function createDefaultPresetFilters(client, userId, workspaceId) {
  try {
    console.log(`🔧 Creating 9 preset filters for user ${userId} in workspace ${workspaceId}`);
    
    // Define the 9 preset filters (same as in migration 009)
    const presetFilters = [
      { name: 'Hide Completed', view_mode: 'planner', operator: 'AND', is_default: true },
      { name: 'Assigned to Me', view_mode: 'planner', operator: 'AND', is_default: false },
      { name: 'Due in 7 Days', view_mode: 'planner', operator: 'AND', is_default: false },
      { name: 'Overdue Tasks', view_mode: 'planner', operator: 'AND', is_default: false },
      { name: 'High/Urgent Priority', view_mode: 'planner', operator: 'AND', is_default: false },
      { name: 'Active in Past 7 Days', view_mode: 'tracker', operator: 'OR', is_default: true },
      { name: 'Unchanged in Past 14 Days', view_mode: 'tracker', operator: 'AND', is_default: false },
      { name: 'Lasted More Than 1 Day', view_mode: 'tracker', operator: 'AND', is_default: false }
    ];

    // Define the conditions for each filter
    const filterConditions = {
      'Hide Completed': [
        { condition_type: 'list', field: 'status', operator: '!=', values: '["done"]' }
      ],
      'Assigned to Me': [
        { condition_type: 'list', field: 'assignee', operator: '=', values: '["current_user_id"]' }
      ],
      'Due in 7 Days': [
        { condition_type: 'date_diff', date_from: 'today', date_to: 'due_date', operator: '<=', values: '[7]', unit: 'days' }
      ],
      'Overdue Tasks': [
        { condition_type: 'date_diff', date_from: 'today', date_to: 'due_date', operator: '<', values: '[0]', unit: 'days' },
        { condition_type: 'list', field: 'status', operator: '!=', values: '["done"]' }
      ],
      'High/Urgent Priority': [
        { condition_type: 'list', field: 'priority', operator: 'IN', values: '["high", "urgent"]' }
      ],
      'Active in Past 7 Days': [
        { condition_type: 'list', field: 'status', operator: 'IN', values: '["in_progress", "paused"]' },
        { condition_type: 'date_diff', date_from: 'completion_date', date_to: 'today', operator: '<=', values: '[7]', unit: 'days' }
      ],
      'Unchanged in Past 14 Days': [
        { condition_type: 'list', field: 'status', operator: '!=', values: '["done"]' },
        { condition_type: 'date_diff', date_from: 'last_modified', date_to: 'today', operator: '>', values: '[14]', unit: 'days' }
      ],
      'Lasted More Than 1 Day': [
        { condition_type: 'date_diff', date_from: 'start_date', date_to: 'completion_date', operator: '>', values: '[1]', unit: 'days' }
      ]
    };

    // Insert each filter and its conditions
    for (const filter of presetFilters) {
      // Insert filter preference
      const filterResult = await client.query(
        'INSERT INTO filter_preferences (user_id, workspace_id, name, view_mode, operator, is_default, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id',
        [userId, workspaceId, filter.name, filter.view_mode, filter.operator, filter.is_default]
      );
      
      const filterId = filterResult.rows[0].id;
      
      // Insert conditions for this filter
      const conditions = filterConditions[filter.name] || [];
      for (const condition of conditions) {
        await client.query(
          'INSERT INTO filter_conditions (filter_id, condition_type, field, date_from, date_to, operator, values, unit, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())',
          [
            filterId,
            condition.condition_type,
            condition.field,
            condition.date_from,
            condition.date_to,
            condition.operator,
            condition.values,
            condition.unit
          ]
        );
      }
    }
    
    console.log(`✅ Successfully created 9 preset filters for user ${userId} in workspace ${workspaceId}`);
  } catch (error) {
    console.error(`❌ Error creating preset filters for user ${userId} in workspace ${workspaceId}:`, error);
    throw error;
  }
}

// Helper function to create example tasks for new users
async function createExampleTasks(client, userId, workspaceId) {
  try {
    console.log(`📝 Creating example category, tags, and 7 tasks for user ${userId} in workspace ${workspaceId}`);
    
    const now = moment().utc().format('YYYY-MM-DD HH:mm:ss');
    const today = moment().format('YYYY-MM-DD');
    const tomorrow = moment().add(1, 'day').format('YYYY-MM-DD');
    
    // Create example category
    const categoryResult = await client.query(
      'INSERT INTO categories (name, workspace_id, user_id, hidden, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $5) RETURNING id',
      ['User Guide', workspaceId, userId, false, now]
    );
    const categoryId = categoryResult.rows[0].id;
    
    // Create example tags
    const Tag1Result = await client.query(
      'INSERT INTO tags (name, workspace_id, user_id, hidden, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $5) RETURNING id',
      ['Practice', workspaceId, userId, false, now]
    );
    const Tag1Id = Tag1Result.rows[0].id;
    
    const Tag2Result = await client.query(
      'INSERT INTO tags (name, workspace_id, user_id, hidden, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $5) RETURNING id',
      ['Pro Tips', workspaceId, userId, false, now]
    );
    const Tag2Id = Tag2Result.rows[0].id;
    
    // Define the 7 example tasks with category and tags
    const exampleTasks = [
      {
        title: "Click status button on the left to start working",
        description: "Status cycles: To Do → In Progress → Paused → In Progress → Paused ... \n\nStart date is automatically recorded",
        priority: "normal",
        status: "todo",
        due_date: today,
        category_id: categoryId,
        tag_id: Tag1Id
      },
      {
        title: "Click anywhere on a task to edit it",
        description: "Try clicking the title, description, category, or any part - everything is editable!",
        priority: "normal", 
        status: "in_progress",
        due_date: today,
        category_id: categoryId,
        tag_id: Tag1Id
      },
      {
        title: "Double-click status to mark Done",
        priority: "normal",
        status: "todo",
        due_date: today,
        category_id: categoryId,
        tag_id: Tag1Id
      },
      {
        title: "Create your first real task",
        description: "Edit in the Add New Task section above to create your own tasks",
        priority: "normal",
        status: "todo",
        category_id: categoryId,
        tag_id: Tag1Id
      },
      {
        title: "Plan your day with Planner view",
        description: "Completed tasks are hidden by default.",
        priority: "normal",
        status: "todo",
        category_id: categoryId,
        tag_id: Tag2Id
      },
      {
        title: "Switch to Tracker view to check your recent progress",
        description: "Shows your completed and in-progress tasks in the past 7 days. Change the time period with filters.",
        priority: "normal",
        status: "todo",
        category_id: categoryId,
        tag_id: Tag2Id
      },
      {
        title: "Invite team members to collaborate",
        description: "Navigate to User Menu -> Manage Access to invite others to your workspace",
        priority: "low",
        status: "todo",
        category_id: categoryId,
        tag_id: Tag2Id
      }
    ];

    // Insert each example task
    for (const task of exampleTasks) {
      const taskResult = await client.query(
        'INSERT INTO tasks (user_id, workspace_id, title, description, priority, status, due_date, category_id, tag_id, created_at, last_modified) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10) RETURNING id',
        [userId, workspaceId, task.title, task.description, task.priority, task.status, task.due_date, task.category_id, task.tag_id, now]
      );
      
      const taskId = taskResult.rows[0].id;
      
      // Assign the user as the assignee for this task
      await client.query(
        'INSERT INTO task_assignees (task_id, user_id, assigned_by, assigned_at) VALUES ($1, $2, $2, $3)',
        [taskId, userId, now]
      );
    }
    
    console.log(`✅ Successfully created example category, tags, and 7 tasks for user ${userId} in workspace ${workspaceId}`);
  } catch (error) {
    console.error(`❌ Error creating example tasks for user ${userId} in workspace ${workspaceId}:`, error);
    throw error;
  }
}

module.exports = {
  createDefaultPresetFilters,
  createExampleTasks
};
