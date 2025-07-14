export interface Workspace {
  id: number;
  name: string;
  description?: string;
  is_default?: boolean;
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
  tag_id?: number;

  workspace_id: number;
  priority?: 'urgent' | 'high' | 'normal' | 'low';
  due_date?: string;
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  tag_id?: number;
  priority?: 'urgent' | 'high' | 'normal' | 'low';
  status?: 'todo' | 'in_progress' | 'paused' | 'done';
  start_date?: string;
  due_date?: string;
  completion_date?: string;
}

export interface TaskFilters {
  view?: 'planner' | 'tracker';
  days?: number;
  tag_id?: number;
  status?: string;
  priority?: string;
  show_completed?: boolean;
  workspace_id?: number;
}

export type ViewMode = 'planner' | 'tracker'; 