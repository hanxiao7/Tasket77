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
import TitleTooltip from './TitleTooltip';

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
  const [editingDateType, setEditingDateType] = useState<'due_date' | 'start_date' | 'completion_date' | null>(null);
  const [editingDateValue, setEditingDateValue] = useState('');
  const [editingTagTaskId, setEditingTagTaskId] = useState<number | null>(null);
  const [editingTagValue, setEditingTagValue] = useState('');
  const [editingPriorityTaskId, setEditingPriorityTaskId] = useState<number | null>(null);
  const [editingPriorityValue, setEditingPriorityValue] = useState<Task['priority']>('normal');
  const [tooltipTimers, setTooltipTimers] = useState<Map<number, NodeJS.Timeout>>(new Map());
  const [visibleTooltips, setVisibleTooltips] = useState<Set<number>>(new Set());
  const [titleTooltips, setTitleTooltips] = useState<Set<number>>(new Set());
  const titleRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const truncationTimeouts = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const positionCache = useRef<Map<number, React.CSSProperties>>(new Map());
  const maxWidthCache = useRef<Map<number, number>>(new Map());
  const newTaskInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const newTagInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLSelectElement>(null);

  const checkTitleTruncation = (taskId: number) => {
    const titleRef = titleRefs.current.get(taskId);
    if (titleRef) {
      const isTruncated = titleRef.scrollWidth > titleRef.clientWidth;
      setTitleTooltips(prev => {
        const newSet = new Set(prev);
        if (isTruncated) {
          newSet.add(taskId);
        } else {
          newSet.delete(taskId);
        }
        return newSet;
      });
    }
  };

  const setTitleRef = useCallback((taskId: number, ref: HTMLDivElement | null) => {
    // Use a ref to track if we've already set this ref to avoid infinite loops
    const currentRef = titleRefs.current.get(taskId);
    if (currentRef === ref) {
      return; // No change, don't update
    }
    
    titleRefs.current.set(taskId, ref);
    
    // Only check truncation when ref is set (not when it's null)
    if (ref) {
      // Clear existing timeout for this task
      const existingTimeout = truncationTimeouts.current.get(taskId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }
      
      // Set new timeout
      const timeout = setTimeout(() => {
        checkTitleTruncation(taskId);
        truncationTimeouts.current.delete(taskId);
      }, 100);
      
      truncationTimeouts.current.set(taskId, timeout);
    }
  }, []);

  const getTitleEndPosition = (taskId: number) => {
    const titleRef = titleRefs.current.get(taskId);
    if (!titleRef) return 'right';
    // Check if title is truncated
    const isTruncated = titleRef.scrollWidth > titleRef.clientWidth;
    if (isTruncated) {
      // If truncated, position at the end of visible content (right side of title column)
      return 'end-of-title';
    } else {
      // If not truncated, position at the end of the title text content
      return 'end-of-content';
    }
  };

  const getTitleEndPositionStyle = useCallback((taskId: number) => {
    // Check cache first
    const cached = positionCache.current.get(taskId);
    if (cached) return cached;
    
    const titleRef = titleRefs.current.get(taskId);
    if (!titleRef) return {};
    
    const isTruncated = titleRef.scrollWidth > titleRef.clientWidth;
    let position: React.CSSProperties;
    
    if (isTruncated) {
      // For truncated titles, align start of bubble with right edge of title column
      position = { left: `${titleRef.clientWidth}px` };
    } else {
      // For normal titles, position at the end of the text content with small gap
      // Create a temporary span to measure the actual text width
      const tempSpan = document.createElement('span');
      tempSpan.style.position = 'absolute';
      tempSpan.style.visibility = 'hidden';
      tempSpan.style.whiteSpace = 'nowrap';
      tempSpan.style.fontSize = window.getComputedStyle(titleRef).fontSize;
      tempSpan.style.fontFamily = window.getComputedStyle(titleRef).fontFamily;
      tempSpan.style.fontWeight = window.getComputedStyle(titleRef).fontWeight;
      tempSpan.textContent = titleRef.textContent || '';
      
      document.body.appendChild(tempSpan);
      const textWidth = tempSpan.offsetWidth;
      document.body.removeChild(tempSpan);
      
      position = { left: `${textWidth + 8}px` }; // Add 8px gap after text
    }
    
    // Cache the result
    positionCache.current.set(taskId, position);
    return position;
  }, []);

  const getMaxTooltipWidth = useCallback((taskId: number) => {
    // Check cache first
    if (maxWidthCache.current.has(taskId)) {
      return maxWidthCache.current.get(taskId)!;
    }
    
    // Calculate available space from bubble starting position to table edge
    const titleRef = titleRefs.current.get(taskId);
    if (titleRef) {
      // Find the main container (the outer div that contains all groups)
      const mainContainer = titleRef.closest('.space-y-2');
      if (mainContainer) {
        const containerRect = mainContainer.getBoundingClientRect();
        const titleRect = titleRef.getBoundingClientRect();
        
        // Calculate actual text width to determine bubble starting position
        const tempSpan = document.createElement('span');
        tempSpan.style.position = 'absolute';
        tempSpan.style.visibility = 'hidden';
        tempSpan.style.whiteSpace = 'nowrap';
        tempSpan.style.fontSize = window.getComputedStyle(titleRef).fontSize;
        tempSpan.style.fontFamily = window.getComputedStyle(titleRef).fontFamily;
        tempSpan.style.fontWeight = window.getComputedStyle(titleRef).fontWeight;
        tempSpan.textContent = titleRef.textContent || '';
        
        document.body.appendChild(tempSpan);
        const textWidth = tempSpan.offsetWidth;
        document.body.removeChild(tempSpan);
        
        // Calculate bubble starting position (title left + text width + margin)
        const bubbleStartX = titleRect.left + Math.min(textWidth, titleRef.clientWidth) + 8; // 8px margin after text
        
        // Calculate available space from bubble start to container right edge
        const availableSpace = containerRect.right - bubbleStartX - 20; // 20px margin
        
        console.log(`Task ${taskId}: container right=${containerRect.right}, title left=${titleRect.left}, text width=${textWidth}, bubble start=${bubbleStartX}, available=${availableSpace}`);
        
        // Ensure minimum and maximum reasonable widths
        const maxWidth = Math.max(200, Math.min(availableSpace, 800));
        
        // Cache the result
        maxWidthCache.current.set(taskId, maxWidth);
        
        return maxWidth;
      }
    }
    return 400; // Fallback width
  }, []);

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
      
      // Clear caches when data changes
      positionCache.current.clear();
      maxWidthCache.current.clear();
      
      // Set expansion state based on view mode
      if (viewMode === 'planner') {
        // Always expand In Progress & Paused and To Do sections
        const plannerExpanded = new Set([1, 2]); // In Progress & Paused, To Do
        if (filters.show_completed) {
          plannerExpanded.add(3); // Completed
        }
        setExpandedTags(plannerExpanded);
      } else {
        // Always expand all tags in tracker view
        const allTagIds = new Set(tagsData.map(tag => tag.id));
        allTagIds.add(-1); // Add unassigned tag ID
        setExpandedTags(allTagIds);
      }
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

  const handlePrioritySave = async (taskId: number) => {
    try {
      console.log(`🚩 Updating task priority: "${editingPriorityValue}"`);
      await apiService.updateTask(taskId, { priority: editingPriorityValue });
      await loadData();
    } catch (error) {
      console.error('Error updating task priority:', error);
    } finally {
      setEditingPriorityTaskId(null);
      setEditingPriorityValue('normal');
    }
  };

  const handlePriorityCancel = () => {
    setEditingPriorityTaskId(null);
    setEditingPriorityValue('normal');
  };

  const handlePriorityKeyPress = (e: React.KeyboardEvent, taskId: number) => {
    if (e.key === 'Enter') {
      handlePrioritySave(taskId);
    } else if (e.key === 'Escape') {
      handlePriorityCancel();
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

  const groupTasksByStatus = () => {
    const grouped: { [key: string]: Task[] } = {
      'In Progress & Paused': [],
      'To Do': [],
      'Completed': []
    };
    
    tasks.forEach(task => {
      if (task.status === 'in_progress' || task.status === 'paused') {
        grouped['In Progress & Paused'].push(task);
      } else if (task.status === 'todo') {
        grouped['To Do'].push(task);
      } else if (task.status === 'done') {
        grouped['Completed'].push(task);
      }
    });
    
    return grouped;
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

  // Use different grouping based on view mode
  const groupedTasks = viewMode === 'planner' ? groupTasksByStatus() : groupTasksByTag();

  // Sort status groups for planner view
  const sortedStatusNames = viewMode === 'planner' ? 
    ['In Progress & Paused', 'To Do', 'Completed'] : 
    Object.keys(groupedTasks).sort((a, b) => {
      if (a === 'Unassigned') return -1;
      if (b === 'Unassigned') return 1;
      return a.localeCompare(b);
    });

  // Get status ID for unassigned status (use -1 as special ID)
  const getStatusId = (statusName: string) => {
    if (statusName === 'In Progress & Paused') return 1;
    if (statusName === 'To Do') return 2;
    if (statusName === 'Completed') return 3;
    return -1;
  };

  // Get tag ID for unassigned tag (use -1 as special ID) - only for tracker view
  const getTagId = (tagName: string) => {
    if (tagName === 'Unassigned') return -1;
    return tags.find(t => t.name === tagName)?.id || 0;
  };

  // Check if status is expanded (including completed) - only for planner view
  const isStatusExpanded = (statusName: string) => {
    if (viewMode !== 'planner') return false;
    const statusId = getStatusId(statusName);
    if (statusName === 'Completed') {
      return filters.show_completed && expandedTags.has(statusId);
    }
    return expandedTags.has(statusId);
  };

  // Check if tag is expanded (including unassigned) - only for tracker view
  const isTagExpanded = (tagName: string) => {
    if (viewMode !== 'tracker') return false;
    const tagId = getTagId(tagName);
    return expandedTags.has(tagId);
  };

  const toggleStatusExpansion = (statusId: number) => {
    const newExpanded = new Set(expandedTags);
    if (newExpanded.has(statusId)) {
      newExpanded.delete(statusId);
    } else {
      newExpanded.add(statusId);
    }
    setExpandedTags(newExpanded);
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

  const handleDrop = async (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-blue-50', 'border-blue-200');
    const taskId = parseInt(e.dataTransfer.getData('text/plain'));
    
    // Don't update if targetId is 0 (invalid)
    if (targetId === 0) {
      return;
    }
    
    try {
      // Find the task being moved
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      
      if (viewMode === 'planner') {
        // In planner view, we're moving between status groups
        let newStatus: Task['status'];
        if (targetId === 1) { // In Progress & Paused
          newStatus = 'in_progress';
        } else if (targetId === 2) { // To Do
          newStatus = 'todo';
        } else if (targetId === 3) { // Completed
          newStatus = 'done';
        } else {
          return;
        }
        
        console.log(`📦 Moving task "${task.title}" to status: ${task.status} → ${newStatus}`);
        await apiService.updateTaskStatus(taskId, newStatus);
      } else {
        // In tracker view, we're moving between tag groups
        const tagId = targetId === -1 ? undefined : targetId;
        const targetTagName = targetId === -1 ? 'Unassigned' : tags.find(t => t.id === targetId)?.name || 'Unknown';
        
        console.log(`📦 Moving task "${task.title}" to tag: ${task.tag_name || 'Unassigned'} → ${targetTagName}`);
        await apiService.updateTask(taskId, { tag_id: tagId });
      }
      
      await loadData();
    } catch (error) {
      console.error('Error updating task:', error);
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

  const handleTagSave = async (taskId: number) => {
    try {
      const tagId = editingTagValue ? Number(editingTagValue) : undefined;
      const tagName = editingTagValue ? tags.find(t => t.id === Number(editingTagValue))?.name || 'Unknown' : 'Unassigned';
      console.log(`🏷️ Updating task tag: "${tagName}"`);
      await apiService.updateTask(taskId, { tag_id: tagId });
      await loadData();
    } catch (error) {
      console.error('Error updating task tag:', error);
    } finally {
      setEditingTagTaskId(null);
      setEditingTagValue('');
    }
  };

  const handleTagCancel = () => {
    setEditingTagTaskId(null);
    setEditingTagValue('');
  };

  const handleTagKeyPress = (e: React.KeyboardEvent, taskId: number) => {
    if (e.key === 'Enter') {
      handleTagSave(taskId);
    } else if (e.key === 'Escape') {
      handleTagCancel();
    }
  };

  const handleCreateTagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateTag();
    }
  };

  const handleDateClick = (task: Task, dateType: 'due_date' | 'start_date' | 'completion_date') => {
    setEditingDateTaskId(task.id);
    setEditingDateType(dateType);
    setEditingDateValue(task[dateType] || '');
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
    }
  };

  const handleDateCancel = () => {
    setEditingDateTaskId(null);
    setEditingDateType(null);
    setEditingDateValue('');
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

  const handleDescriptionSave = async (taskId: number, description: string) => {
    try {
      console.log(`📝 Updating task description: "${description}"`);
      await apiService.updateTask(taskId, { description });
      await loadData();
    } catch (error) {
      console.error('Error updating task description:', error);
      throw error;
    }
  };

  const handleDescriptionTooltipClose = () => {
    setVisibleTooltips(new Set());
  };

  const showTooltip = (taskId: number) => {
    // Clear any existing timer for this task
    const existingTimer = tooltipTimers.get(taskId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      setTooltipTimers(prev => {
        const newMap = new Map(prev);
        newMap.delete(taskId);
        return newMap;
      });
    }

    // Add to visible tooltips
    setVisibleTooltips(prev => new Set(Array.from(prev).concat([taskId])));
  };

  const hideTooltip = (taskId: number) => {
    // Set a timer to hide the tooltip after 0.5 seconds
    const timer = setTimeout(() => {
      setVisibleTooltips(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
      
      // No need to track active tooltip anymore
      
      // Clear the timer from the map
      setTooltipTimers(prev => {
        const newMap = new Map(prev);
        newMap.delete(taskId);
        return newMap;
      });
    }, 800);

    // Store the timer
    setTooltipTimers(prev => new Map(prev).set(taskId, timer));
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
              onKeyPress={handleCreateTagKeyPress}
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

      {/* Tasks by status/tag */}
      {sortedStatusNames.map((groupName) => (
        <div key={groupName} className="border rounded">
          {/* Group header */}
          <div 
            className="flex items-center justify-between p-2 bg-gray-100 cursor-pointer hover:bg-gray-200"
            onClick={() => {
              if (viewMode === 'planner') {
                toggleStatusExpansion(getStatusId(groupName));
              } else {
                toggleTagExpansion(getTagId(groupName));
              }
            }}
          >
            <div className="flex items-center space-x-2">
              {(viewMode === 'planner' ? isStatusExpanded(groupName) : isTagExpanded(groupName)) ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <span className="font-medium text-sm">{groupName}</span>
              <span className="text-xs text-gray-500">({groupedTasks[groupName].length})</span>
            </div>
          </div>

          {/* Tasks in group */}
          {(viewMode === 'planner' ? isStatusExpanded(groupName) : isTagExpanded(groupName)) && (
            <div 
              className="divide-y"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => {
                if (viewMode === 'planner') {
                  const statusId = getStatusId(groupName);
                  if (statusId) {
                    handleDrop(e, statusId);
                  }
                } else {
                  const tagId = getTagId(groupName);
                  if (tagId) {
                    handleDrop(e, tagId);
                  }
                }
              }}
            >
              {/* Column headers */}
              <div className="flex items-center space-x-3 p-2 bg-gray-50 text-xs font-medium text-gray-600 border-b">
                <div className="w-8"></div> {/* Status */}
                <div className="w-6"></div> {/* Priority */}
                <div className="flex-1">Task</div>
                {viewMode === 'planner' && <div className="w-20 text-center">Tag</div>}
                <div className="w-16 text-center">Start</div>
                {viewMode === 'tracker' && <div className="w-16 text-center">Complete</div>}
                <div className="w-16 text-center">Due</div>
              </div>
              
              {groupedTasks[groupName].map((task) => (
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
                    {editingPriorityTaskId === task.id ? (
                      <select
                        value={editingPriorityValue}
                        onChange={(e) => setEditingPriorityValue(e.target.value as Task['priority'])}
                        onKeyPress={(e) => handlePriorityKeyPress(e, task.id)}
                        onBlur={() => handlePrioritySave(task.id)}
                        className="text-xs border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                        title="Press Enter to save, Escape to cancel"
                        data-task-id={task.id}
                        autoFocus
                      >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePriorityClick(task);
                        }}
                        className="p-1 rounded hover:bg-gray-200 transition-colors cursor-pointer"
                        title={`Click to cycle priority (${task.priority})`}
                      >
                    {getPriorityIcon(task.priority)}
                      </button>
                    )}
                  </div>

                  {/* Task title */}
                  <div className="flex-1 min-w-0 relative">
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
                      <div className="relative">
                        <div 
                          ref={(ref) => setTitleRef(task.id, ref)}
                          className="text-sm font-medium truncate cursor-pointer hover:text-blue-600 hover:bg-blue-50 px-1 py-1 rounded"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTitleClick(task);
                          }}
                                                  onMouseEnter={() => {
                          showTooltip(task.id);
                        }}
                        onMouseLeave={() => {
                          hideTooltip(task.id);
                        }}
                        >
                      {task.title}
                    </div>
                        
                        {/* Title Tooltip - show on hover for truncated titles only */}
                        {titleTooltips.has(task.id) && hoveredTask === task.id && (
                          <TitleTooltip title={task.title} titleRef={titleRefs.current.get(task.id)} />
                        )}
                      </div>
                    )}
                    {task.sub_task_count > 0 && (
                      <div className="text-xs text-gray-500">
                        {task.completed_sub_tasks}/{task.sub_task_count} sub-tasks
                      </div>
                    )}
                    
                    {/* Description Tooltip */}
                    {visibleTooltips.has(task.id) && (
                      <div
                        onMouseEnter={() => {
                          // Clear any existing timer when mouse enters tooltip
                          const existingTimer = tooltipTimers.get(task.id);
                          if (existingTimer) {
                            clearTimeout(existingTimer);
                            setTooltipTimers(prev => {
                              const newMap = new Map(prev);
                              newMap.delete(task.id);
                              return newMap;
                            });
                          }
                        }}
                        onMouseLeave={() => hideTooltip(task.id)}
                        style={{ 
                          zIndex: 1000
                        }}
                      >
                        <TaskTooltip 
                          description={task.description || ''}
                          taskId={task.id}
                          onSave={handleDescriptionSave}
                          onClose={handleDescriptionTooltipClose}
                          position={getTitleEndPosition(task.id)}
                          positionStyle={getTitleEndPositionStyle(task.id)}
                          maxWidth={getMaxTooltipWidth(task.id)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Tag */}
                  {viewMode === 'planner' && (
                    <div className="flex-shrink-0 w-20 text-center">
                      <select
                        ref={editingTagTaskId === task.id ? tagInputRef : undefined}
                        value={editingTagTaskId === task.id ? editingTagValue : (task.tag_id?.toString() || '')}
                        onChange={(e) => {
                          if (editingTagTaskId === task.id) {
                            setEditingTagValue(e.target.value);
                          } else {
                            // If not in editing mode, start editing and set the value
                            setEditingTagTaskId(task.id);
                            setEditingTagValue(e.target.value);
                          }
                        }}
                        onKeyPress={(e) => {
                          if (editingTagTaskId === task.id) {
                            handleTagKeyPress(e, task.id);
                          }
                        }}
                        onBlur={() => {
                          if (editingTagTaskId === task.id) {
                            handleTagSave(task.id);
                          }
                        }}
                        onFocus={() => {
                          if (editingTagTaskId !== task.id) {
                            setEditingTagTaskId(task.id);
                            setEditingTagValue(task.tag_id?.toString() || '');
                          }
                        }}
                        className={clsx(
                          "text-xs rounded px-1 py-1 w-full transition-all",
                          editingTagTaskId === task.id 
                            ? "border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500" 
                            : "border border-transparent hover:border-gray-300 hover:bg-blue-50 cursor-pointer text-sm font-medium"
                        )}
                        title={editingTagTaskId === task.id ? "Press Enter to save, Escape to cancel" : "Click to edit tag"}
                      >
                        <option value="">Unassigned</option>
                        {tags.map((tag) => (
                          <option key={tag.id} value={tag.id}>
                            {tag.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

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

                  {/* Completion date - only show in tracker view */}
                  {viewMode === 'tracker' && (
                    <div className="flex-shrink-0 w-16 text-center">
                      {editingDateTaskId === task.id && editingDateType === 'completion_date' ? (
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
                            handleDateClick(task, 'completion_date');
                          }}
                          title="Click to set completion date"
                        >
                          {task.completion_date ? (
                            <span>{formatDate(task.completion_date)}</span>
                          ) : (
                            <Calendar className="w-3 h-3" />
                          )}
                        </div>
                      )}
                    </div>
                  )}

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
                due_date: updatedTask.due_date,
                completion_date: updatedTask.completion_date
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