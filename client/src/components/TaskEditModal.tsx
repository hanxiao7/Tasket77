import React, { useState, useRef, useEffect } from 'react';
import { Task, Tag } from '../types';
import { apiService } from '../services/api';
import { X, Save, Flag, Circle, Play, Pause, CheckCircle } from 'lucide-react';
import clsx from 'clsx';

interface TaskEditModalProps {
  task: Task;
  tags: Tag[];
  onClose: () => void;
  onSave: (task: Task) => void;
  onUpdate?: (task: Task) => void;
}

const TaskEditModal: React.FC<TaskEditModalProps> = ({ task, tags, onClose, onSave, onUpdate }) => {
  const formatDateForInput = (dateString: string | undefined) => {
    if (!dateString) return '';
    
    try {
      // Handle different date formats that might come from the database
      const date = new Date(dateString);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return '';
      }
      
      // Format as YYYY-MM-DD for HTML date input
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  };

  const [formData, setFormData] = useState({
    title: task.title,
    description: task.description || '',
    tag_id: task.tag_id || '',
    priority: task.priority,
    status: task.status,
    start_date: formatDateForInput(task.start_date),
    due_date: formatDateForInput(task.due_date),
    completion_date: formatDateForInput(task.completion_date)
  });
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState(task.title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'todo':
        return <Circle className="w-5 h-5" />;
      case 'in_progress':
        return <Play className="w-5 h-5" />;
      case 'paused':
        return <Pause className="w-5 h-5" />;
      case 'done':
        return <CheckCircle className="w-5 h-5" />;
      default:
        return <Circle className="w-5 h-5" />;
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
    const baseClasses = "w-5 h-5";
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

  const handleStatusClick = async () => {
    let newStatus: Task['status'];
    
    switch (formData.status) {
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
    
    setFormData({ ...formData, status: newStatus });
    await handleStatusAutoSave(newStatus);
  };

  const handlePriorityClick = async () => {
    let newPriority: Task['priority'];
    
    switch (formData.priority) {
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
    
    setFormData({ ...formData, priority: newPriority });
    await handlePriorityAutoSave(newPriority);
  };

  const handleTitleClick = () => {
    setIsEditingTitle(true);
    setEditingTitleValue(formData.title);
    
    // Focus the input after a brief delay to ensure it's rendered
    setTimeout(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }, 10);
  };

  const handleTitleSave = async () => {
    if (!editingTitleValue.trim()) return;
    
    setFormData({ ...formData, title: editingTitleValue.trim() });
    setIsEditingTitle(false);
    
    // Trigger autosave
    await handleTitleAutoSave(editingTitleValue.trim());
  };

  const handleTitleCancel = () => {
    setEditingTitleValue(formData.title);
    setIsEditingTitle(false);
  };

  const handleTitleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      handleTitleCancel();
    }
  };

  // Autosave functions for each field
  const handleTitleAutoSave = async (newTitle: string) => {
    if (!newTitle.trim() || newTitle.trim() === task.title) return;
    
    try {
      console.log(`✏️ Auto-saving task title: "${newTitle.trim()}"`);
      await apiService.updateTask(task.id, { title: newTitle.trim() });
      onUpdate?.({ ...task, title: newTitle.trim() });
    } catch (error) {
      console.error('Error auto-saving task title:', error);
    }
  };

  const handleDescriptionAutoSave = async (newDescription: string) => {
    const currentDescription = task.description || '';
    const finalDescription = newDescription.trim() || undefined;
    
    if (finalDescription === currentDescription) return;
    
    try {
      console.log(`📝 Auto-saving task description: "${finalDescription}"`);
      await apiService.updateTask(task.id, { description: finalDescription });
      onUpdate?.({ ...task, description: finalDescription });
    } catch (error) {
      console.error('Error auto-saving task description:', error);
    }
  };

  const handleTagAutoSave = async (newTagId: string) => {
    const currentTagId = task.tag_id || '';
    const finalTagId = newTagId ? Number(newTagId) : undefined;
    
    if (finalTagId === currentTagId) return;
    
    try {
      const tagName = finalTagId ? tags.find(t => t.id === finalTagId)?.name || 'Unknown' : 'Unassigned';
      console.log(`🏷️ Auto-saving task tag: "${tagName}"`);
      await apiService.updateTask(task.id, { tag_id: finalTagId });
      onUpdate?.({ ...task, tag_id: finalTagId, tag_name: tagName });
    } catch (error) {
      console.error('Error auto-saving task tag:', error);
    }
  };

  const handleStatusAutoSave = async (newStatus: Task['status']) => {
    if (newStatus === task.status) return;
    
    try {
      console.log(`🔄 Auto-saving task status: ${task.status} → ${newStatus}`);
      await apiService.updateTaskStatus(task.id, newStatus);
      onUpdate?.({ ...task, status: newStatus });
    } catch (error) {
      console.error('Error auto-saving task status:', error);
    }
  };

  const handlePriorityAutoSave = async (newPriority: Task['priority']) => {
    if (newPriority === task.priority) return;
    
    try {
      console.log(`🚩 Auto-saving task priority: ${task.priority} → ${newPriority}`);
      await apiService.updateTask(task.id, { priority: newPriority });
      onUpdate?.({ ...task, priority: newPriority });
    } catch (error) {
      console.error('Error auto-saving task priority:', error);
    }
  };

  const handleDateAutoSave = async (dateType: 'start_date' | 'due_date' | 'completion_date', newDate: string) => {
    const currentDate = task[dateType] || '';
    const finalDate = newDate || null;
    
    if (finalDate === currentDate) return;
    
    try {
      console.log(`📅 Auto-saving task ${dateType}: "${finalDate}"`);
      await apiService.updateTask(task.id, { [dateType]: finalDate });
      onUpdate?.({ ...task, [dateType]: finalDate });
    } catch (error) {
      console.error(`Error auto-saving task ${dateType}:`, error);
    }
  };

  const autoResizeTextarea = () => {
    if (descriptionRef.current) {
      descriptionRef.current.style.height = 'auto';
      const scrollHeight = descriptionRef.current.scrollHeight;
      const minHeight = 100; // Minimum height (4 rows * 25px per row)
      const maxHeight = 400; // Maximum height before scrolling
      descriptionRef.current.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`;
    }
  };

  // Auto-resize textarea when description changes
  useEffect(() => {
    autoResizeTextarea();
  }, [formData.description]);



  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-6">
      <div className="bg-gray-50 rounded-lg p-10 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 mr-4">
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={editingTitleValue}
                onChange={(e) => setEditingTitleValue(e.target.value)}
                onKeyPress={handleTitleKeyPress}
                onBlur={handleTitleSave}
                className="text-lg font-semibold text-gray-900 bg-transparent border-none outline-none w-full"
                placeholder="Enter task title..."
              />
            ) : (
              <h2 
                className="text-lg font-semibold text-gray-900 break-words cursor-pointer hover:text-blue-600 hover:bg-blue-50 px-1 py-1 rounded"
                onClick={handleTitleClick}
                title="Click to edit title"
              >
                {formData.title}
              </h2>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form className="space-y-4">
          {/* Tag and Due Date - side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tag
              </label>
              <select
                value={formData.tag_id}
                onChange={async (e) => {
                  setFormData({ ...formData, tag_id: e.target.value });
                  await handleTagAutoSave(e.target.value);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a tag</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={formData.due_date}
                onChange={async (e) => {
                  setFormData({ ...formData, due_date: e.target.value });
                  await handleDateAutoSave('due_date', e.target.value);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Status and Priority - side by side with cycling buttons */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleStatusClick}
                  className={clsx(
                    "px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-200 transition-colors min-w-[44px] flex items-center justify-center",
                    getStatusColor(formData.status)
                  )}
                  title="Click to cycle status"
                >
                  {getStatusIcon(formData.status)}
                </button>
                <select
                  value={formData.status}
                  onChange={async (e) => {
                    const newStatus = e.target.value as Task['status'];
                    setFormData({ ...formData, status: newStatus });
                    await handleStatusAutoSave(newStatus);
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="paused">Paused</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handlePriorityClick}
                  className="px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-200 transition-colors min-w-[44px] flex items-center justify-center"
                  title="Click to cycle priority"
                >
                  {getPriorityIcon(formData.priority)}
                </button>
                <select
                  value={formData.priority}
                  onChange={async (e) => {
                    const newPriority = e.target.value as Task['priority'];
                    setFormData({ ...formData, priority: newPriority });
                    await handlePriorityAutoSave(newPriority);
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
          </div>

          {/* Start Date and Completion Date - side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={async (e) => {
                  setFormData({ ...formData, start_date: e.target.value });
                  await handleDateAutoSave('start_date', e.target.value);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Completion Date
              </label>
              <input
                type="date"
                value={formData.completion_date}
                onChange={async (e) => {
                  setFormData({ ...formData, completion_date: e.target.value });
                  await handleDateAutoSave('completion_date', e.target.value);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Description - full width at bottom */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              ref={descriptionRef}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              onBlur={async () => await handleDescriptionAutoSave(formData.description)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Enter task description..."
              style={{ minHeight: '100px', maxHeight: '400px' }}
            />
          </div>


        </form>
      </div>
    </div>
  );
};

export default TaskEditModal; 