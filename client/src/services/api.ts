import { Task, Tag, Workspace, CreateTaskData, UpdateTaskData, TaskFilters, TaskHistory } from '../types';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

class ApiService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Workspaces
  async getWorkspaces(): Promise<Workspace[]> {
    return this.request<Workspace[]>('/workspaces');
  }

  async createWorkspace(name: string, description?: string): Promise<Workspace> {
    return this.request<Workspace>('/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  }

  async updateWorkspace(id: number, name: string, description?: string): Promise<Workspace> {
    return this.request<Workspace>(`/workspaces/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, description }),
    });
  }

  async deleteWorkspace(id: number): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/workspaces/${id}`, {
      method: 'DELETE',
    });
  }

  async setDefaultWorkspace(id: number): Promise<Workspace> {
    return this.request<Workspace>(`/workspaces/${id}/set-default`, {
      method: 'PATCH',
    });
  }

  // Tags
  async getTags(includeHidden?: boolean, workspaceId?: number): Promise<Tag[]> {
    const params = new URLSearchParams();
    if (includeHidden) {
      params.append('include_hidden', 'true');
    }
    if (workspaceId) {
      params.append('workspace_id', workspaceId.toString());
    }
    
    const queryString = params.toString();
    const endpoint = queryString ? `/tags?${queryString}` : '/tags';
    return this.request<Tag[]>(endpoint);
  }

  async createTag(name: string, workspaceId: number): Promise<Tag> {
    return this.request<Tag>('/tags', {
      method: 'POST',
      body: JSON.stringify({ name, workspace_id: workspaceId }),
    });
  }

  async updateTag(id: number, name: string): Promise<Tag> {
    return this.request<Tag>(`/tags/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  }

  async deleteTag(id: number): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/tags/${id}`, {
      method: 'DELETE',
    });
  }

  async toggleTagHidden(id: number): Promise<Tag> {
    return this.request<Tag>(`/tags/${id}/toggle-hidden`, {
      method: 'PATCH',
    });
  }

  // Tasks
  async getTasks(filters?: TaskFilters): Promise<Task[]> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    
    const queryString = params.toString();
    const endpoint = queryString ? `/tasks?${queryString}` : '/tasks';
    return this.request<Task[]>(endpoint);
  }

  async getTask(id: number): Promise<Task> {
    return this.request<Task>(`/tasks/${id}`);
  }

  async createTask(taskData: CreateTaskData): Promise<Task> {
    return this.request<Task>('/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData),
    });
  }

  async updateTask(id: number, taskData: UpdateTaskData): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(taskData),
    });
  }

  async updateTaskStatus(id: number, status: Task['status'], notes?: string): Promise<{ success: boolean; status: Task['status'] }> {
    return this.request<{ success: boolean; status: Task['status'] }>(`/tasks/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes }),
    });
  }

  async deleteTask(id: number): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  async getTaskHistory(id: number): Promise<TaskHistory[]> {
    return this.request<TaskHistory[]>(`/tasks/${id}/history`);
  }

  // Export
  async exportTasks(): Promise<Task[]> {
    return this.request<Task[]>('/export');
  }
}

export const apiService = new ApiService(); 