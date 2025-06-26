import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Task, TaskFilters, Area } from '../types';
import { apiService } from '../services/api';
import { format } from 'date-fns';
import { 
  Circle, 
  Play, 
  Pause, 
  CheckCircle, 
  Flag, 
  Calendar,
  Plus,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import clsx from 'clsx';
import TaskEditModal from './TaskEditModal';
import TaskTooltip from './TaskTooltip';

interface TaskListProps {
  viewMode: 'planner' | 'tracker';
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
}

const TaskList: React.FC<TaskListProps> = ({ viewMode, filters, onFiltersChange }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [hoveredTask, setHoveredTask] = useState<number | null>(null);
  const [expandedAreas, setExpandedAreas] = useState<Set<number>>(new Set());
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const newTaskInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [tasksData, areasData] = await Promise.all([
        apiService.getTasks(filters),
        apiService.getAreas()
      ]);
      setTasks(tasksData);
      setAreas(areasData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusClick = async (task: Task) => {
    try {
      let newStatus: Task['status'];
      
      switch (task.status) {
        case 'todo':
          newStatus = 'in_progress';
          break;
        case 'in_progress':
          newStatus = 'paused';
          break;
        case 'paused':
          newStatus = 'in_progress';
          break;
        default:
          return;
      }
      
      await apiService.updateTaskStatus(task.id, newStatus);
      await loadData();
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const handleStatusDoubleClick = async (task: Task) => {
    try {
      await apiService.updateTaskStatus(task.id, 'done');
      await loadData();
    } catch (error) {
      console.error('Error completing task:', error);
    }
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    
    try {
      setIsCreatingTask(true);
      await apiService.createTask({
        title: newTaskTitle.trim(),
        area_id: filters.area_id
      });
      setNewTaskTitle('');
      await loadData();
    } catch (error) {
      console.error('Error creating task:', error);
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateTask();
    }
  };

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'todo':
        return <Circle className="w-4 h-4" />;
      case 'in_progress':
        return <Play className="w-4 h-4" />;
      case 'paused':
        return <Pause className="w-4 h-4" />;
      case 'done':
        return <CheckCircle className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'todo':
        return 'text-gray-400 hover:text-gray-600';
      case 'in_progress':
        return 'text-blue-500 hover:text-blue-700';
      case 'paused':
        return 'text-yellow-500 hover:text-yellow-700';
      case 'done':
        return 'text-green-500 hover:text-green-700';
    }
  };

  const getPriorityIcon = (priority: Task['priority']) => {
    const baseClasses = "w-3 h-3";
    switch (priority) {
      case 'urgent':
        return <Flag className={clsx(baseClasses, "text-red-500 fill-red-500")} />;
      case 'high':
        return <Flag className={clsx(baseClasses, "text-yellow-500 fill-yellow-500")} />;
      case 'normal':
        return <Flag className={clsx(baseClasses, "text-green-500 fill-green-500")} />;
      case 'low':
        return <Flag className={clsx(baseClasses, "text-gray-400 fill-gray-400")} />;
    }
  };

  const toggleAreaExpansion = (areaId: number) => {
    const newExpanded = new Set(expandedAreas);
    if (newExpanded.has(areaId)) {
      newExpanded.delete(areaId);
    } else {
      newExpanded.add(areaId);
    }
    setExpandedAreas(newExpanded);
  };

  const groupTasksByArea = () => {
    const grouped: { [key: string]: Task[] } = {};
    tasks.forEach(task => {
      const areaName = task.area_name || 'Unassigned';
      if (!grouped[areaName]) {
        grouped[areaName] = [];
      }
      grouped[areaName].push(task);
    });
    return grouped;
  };

  const groupedTasks = groupTasksByArea();

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-2">
      {/* New task input */}
      <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded border">
        <Plus className="w-4 h-4 text-gray-400" />
        <input
          ref={newTaskInputRef}
          type="text"
          placeholder="Add new task..."
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isCreatingTask}
          className="flex-1 bg-transparent border-none outline-none text-sm"
        />
      </div>

      {/* Tasks by area */}
      {Object.entries(groupedTasks).map(([areaName, areaTasks]) => (
        <div key={areaName} className="border rounded">
          {/* Area header */}
          <div 
            className="flex items-center justify-between p-2 bg-gray-100 cursor-pointer hover:bg-gray-200"
            onClick={() => toggleAreaExpansion(areas.find(a => a.name === areaName)?.id || 0)}
          >
            <div className="flex items-center space-x-2">
              {expandedAreas.has(areas.find(a => a.name === areaName)?.id || 0) ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <span className="font-medium text-sm">{areaName}</span>
              <span className="text-xs text-gray-500">({areaTasks.length})</span>
            </div>
          </div>

          {/* Tasks in area */}
          {expandedAreas.has(areas.find(a => a.name === areaName)?.id || 0) && (
            <div className="divide-y">
              {areaTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center space-x-3 p-3 hover:bg-gray-50 relative"
                  onMouseEnter={() => setHoveredTask(task.id)}
                  onMouseLeave={() => setHoveredTask(null)}
                  onDoubleClick={() => setEditingTask(task)}
                >
                  {/* Status button */}
                  <button
                    onClick={() => handleStatusClick(task)}
                    onDoubleClick={() => handleStatusDoubleClick(task)}
                    className={clsx(
                      "p-1 rounded hover:bg-gray-200 transition-colors",
                      getStatusColor(task.status)
                    )}
                    title={`Click to change status, double-click to complete`}
                  >
                    {getStatusIcon(task.status)}
                  </button>

                  {/* Priority flag */}
                  <div className="flex-shrink-0">
                    {getPriorityIcon(task.priority)}
                  </div>

                  {/* Task title */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {task.title}
                    </div>
                    {task.sub_task_count > 0 && (
                      <div className="text-xs text-gray-500">
                        {task.completed_sub_tasks}/{task.sub_task_count} sub-tasks
                      </div>
                    )}
                  </div>

                  {/* Due date */}
                  {task.due_date && (
                    <div className="flex items-center space-x-1 text-xs text-gray-500">
                      <Calendar className="w-3 h-3" />
                      <span>{format(new Date(task.due_date), 'MMM d')}</span>
                    </div>
                  )}

                  {/* Tooltip */}
                  {hoveredTask === task.id && task.description && (
                    <TaskTooltip description={task.description} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Edit modal */}
      {editingTask && (
        <TaskEditModal
          task={editingTask}
          areas={areas}
          onClose={() => setEditingTask(null)}
          onSave={async (updatedTask) => {
            try {
              await apiService.updateTask(updatedTask.id, {
                title: updatedTask.title,
                description: updatedTask.description,
                area_id: updatedTask.area_id,
                priority: updatedTask.priority,
                due_date: updatedTask.due_date
              });
              await loadData();
              setEditingTask(null);
            } catch (error) {
              console.error('Error updating task:', error);
            }
          }}
        />
      )}
    </div>
  );
};

export default TaskList; 