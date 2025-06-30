import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Task, TaskFilters, Tag } from '../types';
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
  ChevronRight,
  Tag as TagIcon
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
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [hoveredTask, setHoveredTask] = useState<number | null>(null);
  const [expandedTags, setExpandedTags] = useState<Set<number>>(new Set());
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [editingTitleTaskId, setEditingTitleTaskId] = useState<number | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [editingDateTaskId, setEditingDateTaskId] = useState<number | null>(null);
  const [editingDateType, setEditingDateType] = useState<'due_date' | 'start_date' | null>(null);
  const [editingDateValue, setEditingDateValue] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const newTaskInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const newTagInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [tasksData, tagsData] = await Promise.all([
        apiService.getTasks({ ...filters, view: viewMode }),
        apiService.getTags()
      ]);
      setTasks(tasksData);
      setTags(tagsData);
      console.log(`📋 Loaded ${tasksData.length} tasks and ${tagsData.length} tags`);
      // Always expand all tags on load (including unassigned tag with ID -1)
      const allTagIds = new Set(tagsData.map(tag => tag.id));
      allTagIds.add(-1); // Add unassigned tag ID
      setExpandedTags(allTagIds);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, viewMode]);

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
        case 'done':
          // Done stays done - no cycling back
          return;
        default:
          return;
      }
      
      console.log(`🔄 Updating task "${task.title}" status: ${task.status} → ${newStatus}`);
      await apiService.updateTaskStatus(task.id, newStatus);
      await loadData();
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const handleStatusDoubleClick = async (task: Task) => {
    try {
      console.log(`✅ Marking task "${task.title}" as done`);
      await apiService.updateTaskStatus(task.id, 'done');
      await loadData();
    } catch (error) {
      console.error('Error completing task:', error);
    }
  };

  const handlePriorityClick = async (task: Task) => {
    try {
      let newPriority: Task['priority'];
      
      switch (task.priority) {
        case 'normal':
          newPriority = 'high';
          break;
        case 'high':
          newPriority = 'urgent';
          break;
        case 'urgent':
          newPriority = 'low';
          break;
        case 'low':
          newPriority = 'normal';
          break;
        default:
          return;
      }
      
      console.log(`🚩 Updating task "${task.title}" priority: ${task.priority} → ${newPriority}`);
      await apiService.updateTask(task.id, { priority: newPriority });
      await loadData();
    } catch (error) {
      console.error('Error updating task priority:', error);
    }
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    
    try {
      setIsCreatingTask(true);
      console.log(`➕ Creating new task: "${newTaskTitle.trim()}"`);
      await apiService.createTask({
        title: newTaskTitle.trim(),
        tag_id: filters.tag_id
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
      default:
        return <Circle className="w-4 h-4" />;
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
      default:
        return 'text-gray-400 hover:text-gray-600';
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

  const toggleTagExpansion = (tagId: number) => {
    const newExpanded = new Set(expandedTags);
    if (newExpanded.has(tagId)) {
      newExpanded.delete(tagId);
    } else {
      newExpanded.add(tagId);
    }
    setExpandedTags(newExpanded);
  };

  const groupTasksByTag = () => {
    const grouped: { [key: string]: Task[] } = {};
    tasks.forEach(task => {
      const tagName = task.tag_name || 'Unassigned';
      if (!grouped[tagName]) {
        grouped[tagName] = [];
      }
      grouped[tagName].push(task);
    });
    return grouped;
  };

  const groupedTasks = groupTasksByTag();

  // Sort tags: Unassigned first, then alphabetically
  const sortedTagNames = Object.keys(groupedTasks).sort((a, b) => {
    if (a === 'Unassigned') return -1;
    if (b === 'Unassigned') return 1;
    return a.localeCompare(b);
  });

  // Get tag ID for unassigned tag (use -1 as special ID)
  const getTagId = (tagName: string) => {
    if (tagName === 'Unassigned') return -1;
    return tags.find(t => t.name === tagName)?.id || 0;
  };

  // Check if tag is expanded (including unassigned)
  const isTagExpanded = (tagName: string) => {
    const tagId = getTagId(tagName);
    return expandedTags.has(tagId);
  };

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData('text/plain', task.id.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('bg-blue-50', 'border-blue-200');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('bg-blue-50', 'border-blue-200');
  };

  const handleDrop = async (e: React.DragEvent, targetTagId: number) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-blue-50', 'border-blue-200');
    const taskId = parseInt(e.dataTransfer.getData('text/plain'));
    
    // Don't update if targetTagId is 0 (invalid tag)
    if (targetTagId === 0) {
      return;
    }
    
    try {
      // Find the task being moved
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      
      // If targetTagId is -1 (unassigned), set area_id to undefined
      const tagId = targetTagId === -1 ? undefined : targetTagId;
      const targetTagName = targetTagId === -1 ? 'Unassigned' : tags.find(t => t.id === targetTagId)?.name || 'Unknown';
      
      console.log(`📦 Moving task "${task.title}" to tag: ${task.tag_name || 'Unassigned'} → ${targetTagName}`);
      await apiService.updateTask(taskId, { tag_id: tagId });
      await loadData();
    } catch (error) {
      console.error('Error updating task tag:', error);
    }
  };

  const handleTitleClick = (task: Task) => {
    setEditingTitleTaskId(task.id);
    setEditingTitleValue(task.title);
    // Focus the input after a brief delay to ensure it's rendered
    setTimeout(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }, 10);
  };

  const handleTitleSave = async (taskId: number) => {
    if (!editingTitleValue.trim()) return;
    
    try {
      console.log(`✏️ Updating task title: "${editingTitleValue.trim()}"`);
      await apiService.updateTask(taskId, { title: editingTitleValue.trim() });
      await loadData();
    } catch (error) {
      console.error('Error updating task title:', error);
    } finally {
      setEditingTitleTaskId(null);
      setEditingTitleValue('');
    }
  };

  const handleTitleCancel = () => {
    setEditingTitleTaskId(null);
    setEditingTitleValue('');
  };

  const handleTitleKeyPress = (e: React.KeyboardEvent, taskId: number) => {
    if (e.key === 'Enter') {
      handleTitleSave(taskId);
    } else if (e.key === 'Escape') {
      handleTitleCancel();
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    
    try {
      setIsCreatingTag(true);
      console.log(`➕ Creating new tag: "${newTagName.trim()}"`);
      await apiService.createTag(newTagName.trim());
      setNewTagName('');
      setShowTagInput(false);
      await loadData();
    } catch (error) {
      console.error('Error creating tag:', error);
    } finally {
      setIsCreatingTag(false);
    }
  };

  const handleTagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateTag();
    }
  };

  const handleDateClick = (task: Task, dateType: 'due_date' | 'start_date') => {
    setEditingDateTaskId(task.id);
    setEditingDateType(dateType);
    setEditingDateValue(task[dateType] || '');
    setShowDatePicker(true);
    // Focus the input after a brief delay to ensure it's rendered
    setTimeout(() => {
      dateInputRef.current?.focus();
      dateInputRef.current?.showPicker?.(); // Show native date picker immediately
    }, 10);
  };

  const handleDateSave = async (taskId: number) => {
    if (!editingDateType) return;
    
    try {
      console.log(`📅 Updating task ${editingDateType}: "${editingDateValue}"`);
      await apiService.updateTask(taskId, { [editingDateType]: editingDateValue || null });
      await loadData();
    } catch (error) {
      console.error('Error updating task date:', error);
    } finally {
      setEditingDateTaskId(null);
      setEditingDateType(null);
      setEditingDateValue('');
      setShowDatePicker(false);
    }
  };

  const handleDateCancel = () => {
    setEditingDateTaskId(null);
    setEditingDateType(null);
    setEditingDateValue('');
    setShowDatePicker(false);
  };

  const handleDateKeyPress = (e: React.KeyboardEvent, taskId: number) => {
    if (e.key === 'Enter') {
      handleDateSave(taskId);
    } else if (e.key === 'Escape') {
      handleDateCancel();
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'MMM d');
    } catch {
      return '';
    }
  };

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

      {/* New tag input */}
      <div className="flex items-center space-x-2 p-2 bg-blue-50 rounded border">
        <TagIcon className="w-4 h-4 text-blue-400" />
        {showTagInput ? (
          <>
            <input
              ref={newTagInputRef}
              type="text"
              placeholder="Enter tag name..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyPress={handleTagKeyPress}
              disabled={isCreatingTag}
              className="flex-1 bg-transparent border-none outline-none text-sm"
              onBlur={() => {
                if (!newTagName.trim()) {
                  setShowTagInput(false);
                }
              }}
            />
            <button
              onClick={handleCreateTag}
              disabled={isCreatingTag || !newTagName.trim()}
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {isCreatingTag ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => {
                setShowTagInput(false);
                setNewTagName('');
              }}
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => {
              setShowTagInput(true);
              setTimeout(() => newTagInputRef.current?.focus(), 10);
            }}
            className="flex-1 text-left text-sm text-blue-600 hover:text-blue-800"
          >
            + Create new tag
          </button>
        )}
      </div>

      {/* Tasks by tag */}
      {sortedTagNames.map((tagName) => (
        <div key={tagName} className="border rounded">
          {/* Tag header */}
          <div 
            className="flex items-center justify-between p-2 bg-gray-100 cursor-pointer hover:bg-gray-200"
            onClick={() => toggleTagExpansion(getTagId(tagName))}
          >
            <div className="flex items-center space-x-2">
              {isTagExpanded(tagName) ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <span className="font-medium text-sm">{tagName}</span>
              <span className="text-xs text-gray-500">({groupedTasks[tagName].length})</span>
            </div>
          </div>

          {/* Tasks in tag */}
          {isTagExpanded(tagName) && (
            <div 
              className="divide-y"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => {
                const tagId = getTagId(tagName);
                if (tagId) {
                  handleDrop(e, tagId);
                }
              }}
            >
              {/* Column headers */}
              <div className="flex items-center space-x-3 p-2 bg-gray-50 text-xs font-medium text-gray-600 border-b">
                <div className="w-8"></div> {/* Status */}
                <div className="w-6"></div> {/* Priority */}
                <div className="flex-1">Task</div>
                <div className="w-16 text-center">Start</div>
                <div className="w-16 text-center">Due</div>
              </div>
              
              {groupedTasks[tagName].map((task) => (
                <div
                  key={task.id}
                  className="flex items-center space-x-3 p-3 hover:bg-gray-50 relative"
                  onMouseEnter={() => setHoveredTask(task.id)}
                  onMouseLeave={() => setHoveredTask(null)}
                  onDoubleClick={() => setEditingTask(task)}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task)}
                >
                  {/* Status button */}
                  <div className="w-8 flex justify-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusClick(task);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleStatusDoubleClick(task);
                      }}
                      className={clsx(
                        "p-1 rounded hover:bg-gray-200 transition-colors",
                        getStatusColor(task.status)
                      )}
                      title={`Click to change status, double-click to complete`}
                    >
                      {getStatusIcon(task.status)}
                    </button>
                  </div>

                  {/* Priority flag */}
                  <div className="w-6 flex justify-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePriorityClick(task);
                      }}
                      className="p-1 rounded hover:bg-gray-200 transition-colors cursor-pointer"
                      title={`Click to change priority (${task.priority})`}
                    >
                      {getPriorityIcon(task.priority)}
                    </button>
                  </div>

                  {/* Task title */}
                  <div className="flex-1 min-w-0">
                    {editingTitleTaskId === task.id ? (
                      <input
                        ref={titleInputRef}
                        type="text"
                        value={editingTitleValue}
                        onChange={(e) => setEditingTitleValue(e.target.value)}
                        onKeyPress={(e) => handleTitleKeyPress(e, task.id)}
                        onBlur={() => handleTitleSave(task.id)}
                        className="w-full bg-transparent border-none outline-none text-sm font-medium"
                        placeholder="Enter task title..."
                      />
                    ) : (
                      <div 
                        className="text-sm font-medium truncate cursor-pointer hover:text-blue-600 hover:bg-blue-50 px-1 py-1 rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTitleClick(task);
                        }}
                        title="Click to edit title"
                      >
                        {task.title}
                      </div>
                    )}
                    {task.sub_task_count > 0 && (
                      <div className="text-xs text-gray-500">
                        {task.completed_sub_tasks}/{task.sub_task_count} sub-tasks
                      </div>
                    )}
                  </div>

                  {/* Start date */}
                  <div className="flex-shrink-0 w-16 text-center">
                    {editingDateTaskId === task.id && editingDateType === 'start_date' ? (
                      <input
                        ref={dateInputRef}
                        type="date"
                        value={editingDateValue}
                        onChange={(e) => setEditingDateValue(e.target.value)}
                        onKeyPress={(e) => handleDateKeyPress(e, task.id)}
                        onBlur={() => handleDateSave(task.id)}
                        className="text-xs border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                        title="Press Enter to save, Escape to cancel"
                      />
                    ) : (
                      <div 
                        className="flex items-center justify-center text-xs text-gray-500 cursor-pointer hover:text-blue-600 hover:bg-blue-50 px-1 py-1 rounded min-h-[20px]"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDateClick(task, 'start_date');
                        }}
                        title="Click to set start date"
                      >
                        {task.start_date ? (
                          <span>{formatDate(task.start_date)}</span>
                        ) : (
                          <Calendar className="w-3 h-3" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Due date */}
                  <div className="flex-shrink-0 w-16 text-center">
                    {editingDateTaskId === task.id && editingDateType === 'due_date' ? (
                      <input
                        ref={dateInputRef}
                        type="date"
                        value={editingDateValue}
                        onChange={(e) => setEditingDateValue(e.target.value)}
                        onKeyPress={(e) => handleDateKeyPress(e, task.id)}
                        onBlur={() => handleDateSave(task.id)}
                        className="text-xs border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                        title="Press Enter to save, Escape to cancel"
                      />
                    ) : (
                      <div 
                        className="flex items-center justify-center text-xs text-gray-500 cursor-pointer hover:text-blue-600 hover:bg-blue-50 px-1 py-1 rounded min-h-[20px]"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDateClick(task, 'due_date');
                        }}
                        title="Click to set due date"
                      >
                        {task.due_date ? (
                          <span>{formatDate(task.due_date)}</span>
                        ) : (
                          <Calendar className="w-3 h-3" />
                        )}
                      </div>
                    )}
                  </div>

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
          tags={tags}
          onClose={() => setEditingTask(null)}
          onSave={async (updatedTask) => {
            try {
              await apiService.updateTask(updatedTask.id, {
                title: updatedTask.title,
                description: updatedTask.description,
                tag_id: updatedTask.tag_id,
                priority: updatedTask.priority,
                status: updatedTask.status,
                start_date: updatedTask.start_date,
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