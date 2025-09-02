export interface Workspace {
  id: number;
  name: string;
  description?: string;
  is_default?: boolean;
  access_level?: 'owner' | 'edit' | 'view';
  created_at?: string;
  updated_at?: string;
  other_users_count?: number;
}

export interface Category {
  id: number;
  name: string;
  workspace_id: number;
  hidden: boolean;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: number;
  name: string;
  workspace_id: number;
  hidden: boolean;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: number;
  title: string;
  description?: string;
  category_id?: number;
  category_name?: string;
  tag_id?: number;
  tag_name?: string;
  workspace_id: number;
  status: 'todo' | 'in_progress' | 'paused' | 'done';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  due_date?: string;
  start_date?: string;
  completion_date?: string;
  assignee_names?: string[];
  assignee_emails?: string[];
  last_modified: string;
  created_at: string;
}

export interface TaskHistory {
  id: number;
  task_id: number;
  status: string;
  action_date: string;
  notes?: string;
}

export interface CreateTaskData {
  title: string;
  description?: string;
  category_id?: number;
  tag_id?: number;
  priority?: Task['priority'];
  due_date?: string;
  workspace_id: number;
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  category_id?: number;
  tag_id?: number;
  priority?: Task['priority'];
  status?: Task['status'];
  start_date?: string;
  due_date?: string;
  completion_date?: string;
}

export interface TaskFilters {
  view?: 'planner' | 'tracker';
  workspace_id?: number;
  grouping?: 'none' | 'status' | 'priority' | 'category' | 'tag';
  
  // Preset filters (array of enabled preset IDs)
  presets: number[];
  
  // Current days values for date-related presets (session-only)
  currentDays?: Record<string, number>;
  
  // Custom filters (for future implementation)
  customFilters?: FilterGroup[];
  // Logic to combine groups
  customFiltersLogic?: 'AND' | 'OR';
  
  // Internal flag to track initial filter loading
  _initialFiltersLoaded?: boolean;
}

export interface FilterGroup {
  id: string;
  conditions: FilterCondition[];
  logic: 'AND' | 'OR';
}

export interface FilterCondition {
  field: 'assignee' | 'status' | 'category' | 'tag' | 'priority' | 'due_date' | 'created_date' | 'completion_date' | 'updated_at' | 'last_modified' | 'start_date';
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'greater_than' | 'greater_than_or_equal' | 'less_than' | 'between' | 'date_diff' | 'is_null' | 'is_not_null';
  values: any[];
  date_field?: string;
  date_range?: number;
  // Custom additions for categorical null handling and date diff
  includeNull?: boolean;
  date_field_2?: string; // for date_diff
  comparator?: 'lt' | 'le' | 'gt' | 'ge' | 'eq';
  days?: number; // for date_diff
}

export interface PresetFilter {
  id: number;
  name: string;
  enabled: boolean;
  view_mode: 'planner' | 'tracker';
  operator: 'AND' | 'OR';
  is_default: boolean;
  conditions: FilterCondition[];
}

export type ViewMode = 'planner' | 'tracker'; 