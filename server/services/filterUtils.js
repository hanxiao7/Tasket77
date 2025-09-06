// Utility functions for filter management

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

module.exports = {
  createDefaultPresetFilters
};
