import { Task, Area, CreateTaskData, UpdateTaskData, TaskFilters, TaskHistory } from '../types';

const API_BASE = 'http://localhost:3001/api';

class ApiService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
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

  // Areas
  async getAreas(): Promise<Area[]> {
    return this.request<Area[]>('/areas');
  }

  async createArea(name: string): Promise<Area> {
    return this.request<Area>('/areas', {
      method: 'POST',
      body: JSON.stringify({ name }),
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