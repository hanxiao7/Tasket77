export interface Workspace {
  id: number;
  name: string;
  description?: string;
  is_default?: boolean;
  access_level?: 'owner' | 'edit' | 'view';
  created_at?: string;
  updated_at?: string;
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
  days?: number;
  category_id?: number;
  status?: Task['status'];
  priority?: Task['priority'];
  show_completed?: boolean;
  workspace_id?: number;
  grouping?: 'none' | 'status' | 'priority' | 'category' | 'tag';
}

export type ViewMode = 'planner' | 'tracker'; 