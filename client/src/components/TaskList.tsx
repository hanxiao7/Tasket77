import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, useMemo } from 'react';
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
  Tag as TagIcon,
  Trash2,
  Edit3,
  MessageSquarePlus
} from 'lucide-react';
import clsx from 'clsx';
import TaskEditModal from './TaskEditModal';
import TaskTooltip from './TaskTooltip';
import TitleTooltip from './TitleTooltip';
import TagEditModal from './TagEditModal';
import TaskRow from './TaskRow';

interface TaskListProps {
  viewMode: 'planner' | 'tracker';
  filters: TaskFilters;
  selectedWorkspaceId: number;
  onFiltersChange: (filters: TaskFilters) => void;
  onSort: () => void;
  onTasksChange?: (tasks: Task[]) => void;
}

const TaskList = React.forwardRef<{ sortTasks: () => void; getTasks: () => Task[] }, TaskListProps>(({ viewMode, filters, selectedWorkspaceId, onFiltersChange, onSort, onTasksChange }, ref) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showTagEditModal, setShowTagEditModal] = useState(false);
  const [showNewTaskTagDropdown, setShowNewTaskTagDropdown] = useState(false);
  const [hoveredTask, setHoveredTask] = useState<number | null>(null);
  const [expandedTags, setExpandedTags] = useState<Set<number>>(new Set());
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [editingTitleTaskId, setEditingTitleTaskId] = useState<number | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [selectedNewTaskTag, setSelectedNewTaskTag] = useState<Record<number, string>>({});
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
  const [chatIcons, setChatIcons] = useState<Set<number>>(new Set());
  const [editingTooltips, setEditingTooltips] = useState<Set<number>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    taskId: number | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    taskId: null
  });
  const titleRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const truncationTimeouts = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const positionCache = useRef<Map<number, React.CSSProperties>>(new Map());
  const maxWidthCache = useRef<Map<number, number>>(new Map());
  const newTaskInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const newTagInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLSelectElement>(null);
  const statusClickTimers = useRef<{ [taskId: number]: NodeJS.Timeout }>({});

  const checkTitleTruncation = (taskId: number) => {
    const titleRef = titleRefs.current.get(taskId);
    if (titleRef) {
      // Force a reflow to ensure accurate measurements
      void titleRef.offsetHeight;
      
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
      
      // Set new timeout with longer delay to ensure DOM is fully rendered
      const timeout = setTimeout(() => {
        checkTitleTruncation(taskId);
        truncationTimeouts.current.delete(taskId);
      }, 200);
      
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

  // Manual sorting function that applies the same logic as the backend
  const sortTasks = useCallback((tasksToSort: Task[]) => {
    if (viewMode === 'planner') {
      return [...tasksToSort].sort((a, b) => {
        // First sort by status: in_progress/paused first, then todo, then done
        const getStatusOrder = (status: Task['status']) => {
          if (status === 'in_progress' || status === 'paused') return 1;
          if (status === 'todo') return 3;
          if (status === 'done') return 4;
          return 5;
        };
        
        const statusOrderA = getStatusOrder(a.status);
        const statusOrderB = getStatusOrder(b.status);
        
        if (statusOrderA !== statusOrderB) {
          return statusOrderA - statusOrderB;
        }
        
        // Then sort by priority: urgent, high, normal, low
        const getPriorityOrder = (priority: Task['priority']) => {
          if (priority === 'urgent') return 1;
          if (priority === 'high') return 2;
          if (priority === 'normal') return 3;
          if (priority === 'low') return 4;
          return 5;
        };
        
        const priorityOrderA = getPriorityOrder(a.priority);
        const priorityOrderB = getPriorityOrder(b.priority);
        
        if (priorityOrderA !== priorityOrderB) {
          return priorityOrderA - priorityOrderB;
        }
        
        // Finally sort by title alphabetically
        return a.title.localeCompare(b.title);
      });
    } else {
      // Tracker view: sort by tag name, then status, then title
      return [...tasksToSort].sort((a, b) => {
        // First sort by tag name
        const tagA = a.tag_name || 'Unassigned';
        const tagB = b.tag_name || 'Unassigned';
        
        if (tagA !== tagB) {
          if (tagA === 'Unassigned') return -1;
          if (tagB === 'Unassigned') return 1;
          return tagA.localeCompare(tagB);
        }
        
        // Then sort by status: done first, then in_progress, paused, todo
        const getStatusOrder = (status: Task['status']) => {
          if (status === 'done') return 1;
          if (status === 'in_progress') return 2;
          if (status === 'paused') return 3;
          if (status === 'todo') return 4;
          return 5;
        };
        
        const statusOrderA = getStatusOrder(a.status);
        const statusOrderB = getStatusOrder(b.status);
        
        if (statusOrderA !== statusOrderB) {
          return statusOrderA - statusOrderB;
        }
        
        // Finally sort by title alphabetically
        return a.title.localeCompare(b.title);
      });
    }
  }, [viewMode]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [tasksData, tagsData] = await Promise.all([
        apiService.getTasks({ ...filters, view: viewMode, workspace_id: selectedWorkspaceId }),
        apiService.getTags(true, selectedWorkspaceId) // Include hidden tags and filter by workspace
      ]);
      
      // Apply sorting to the loaded data
      const sortedTasks = sortTasks(tasksData);
      setTasks(sortedTasks);
      setTags(tagsData);
      console.log(`📋 Loaded ${tasksData.length} tasks and ${tagsData.length} tags`);
      
      // Clear caches when data changes
      positionCache.current.clear();
      maxWidthCache.current.clear();
      
      // Always expand all groups by default
      const groupingMethod = filters.grouping || (viewMode === 'planner' ? 'none' : 'tag');
      
      if (groupingMethod === 'none') {
        setExpandedTags(new Set());
      } else if (groupingMethod === 'status') {
        setExpandedTags(new Set([1, 2, 3])); // All status groups
      } else if (groupingMethod === 'priority') {
        setExpandedTags(new Set([1, 2, 3, 4])); // All priority groups
      } else if (groupingMethod === 'tag') {
        const allTagIds = new Set(tagsData.map(tag => tag.id));
        allTagIds.add(-1); // Add unassigned tag ID
        setExpandedTags(allTagIds);
      }
      
      // Clear title tooltips when data changes to force recalculation
      setTitleTooltips(new Set());
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, viewMode, sortTasks, selectedWorkspaceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Recheck title truncation when view mode changes
  useEffect(() => {
    // Clear existing timeouts
    truncationTimeouts.current.forEach(timeout => clearTimeout(timeout));
    truncationTimeouts.current.clear();
    
    // Recheck truncation for all tasks after a delay
    const timeout = setTimeout(() => {
      tasks.forEach(task => {
        checkTitleTruncation(task.id);
      });
    }, 300);
    
    return () => clearTimeout(timeout);
  }, [viewMode, tasks]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        handleContextMenuClose();
      }
      // Also close tag dropdown when clicking outside
      if (editingTagTaskId !== null) {
        console.log('Closing tag dropdown due to outside click');
        setEditingTagTaskId(null);
        setEditingTagValue('');
      }
      // Also close new task tag dropdown when clicking outside
      if (showNewTaskTagDropdown) {
        setShowNewTaskTagDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [contextMenu.visible, editingTagTaskId, showNewTaskTagDropdown]);

  // Debug editingTagTaskId changes
  useEffect(() => {
    console.log('editingTagTaskId changed to:', editingTagTaskId);
  }, [editingTagTaskId]);

  // Notify parent when tasks change
  useEffect(() => {
    if (onTasksChange) {
      onTasksChange(tasks);
    }
  }, [tasks, onTasksChange]);

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
      
      // Fetch updated task data to get new dates
      const updatedTasks = await apiService.getTasks({ ...filters, view: viewMode, workspace_id: selectedWorkspaceId });
      const updatedTask = updatedTasks.find(t => t.id === task.id);
      
      // Update local state with the updated task data
      setTasks(prevTasks => {
        const updatedTasksList = prevTasks.map(t => {
          if (t.id === task.id && updatedTask) {
            return updatedTask;
          }
          return t;
        });
        return updatedTasksList;
      });
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const handleStatusDoubleClick = async (task: Task) => {
    try {
      console.log(`✅ Double-click detected! Marking task "${task.title}" as done`);
      await apiService.updateTaskStatus(task.id, 'done');
      
      // Update local state immediately for double-click (mark as done)
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      
      setTasks(prevTasks => {
        const updatedTasksList = prevTasks.map(t => {
          if (t.id === task.id) {
            return {
              ...t,
              status: 'done' as const,
              completion_date: now,
              last_modified: now
            };
          }
          return t;
        });
        return updatedTasksList;
      });
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
      
      // Update local state instead of reloading
      setTasks(prevTasks => {
        const updatedTasks = prevTasks.map(t => 
          t.id === task.id ? { ...t, priority: newPriority } as Task : t
        );
        return updatedTasks;
      });
    } catch (error) {
      console.error('Error updating task priority:', error);
    }
  };

  const handlePrioritySave = async (taskId: number) => {
    try {
      console.log(`🚩 Updating task priority: "${editingPriorityValue}"`);
      await apiService.updateTask(taskId, { priority: editingPriorityValue });
      
      // Update local state instead of reloading
      setTasks(prevTasks => {
        const updatedTasks = prevTasks.map(t => 
          t.id === taskId ? { ...t, priority: editingPriorityValue } as Task : t
        );
        return updatedTasks;
      });
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
    
    setIsCreatingTask(true);
    try {
      const selectedTagId = selectedNewTaskTag[selectedWorkspaceId] ? Number(selectedNewTaskTag[selectedWorkspaceId]) : undefined;
      const selectedTagName = selectedTagId ? tags.find(t => t.id === selectedTagId)?.name : undefined;
      
      console.log(`➕ Creating new task: "${newTaskTitle.trim()}" with tag: ${selectedTagName || 'none'}`);
      
      const newTask = await apiService.createTask({
        title: newTaskTitle.trim(),
        tag_id: selectedTagId,
        workspace_id: selectedWorkspaceId
      });
      
      setNewTaskTitle('');
      
      // Add new task to local state (server now returns complete task info)
      setTasks(prevTasks => {
        const updatedTasks = [...prevTasks, newTask as Task];
        return updatedTasks;
      });
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
    const baseClasses = "w-3.5 h-3.5";
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

  // Unified grouping logic with useMemo for performance
  const groupedTasks = useMemo(() => {
    const groupingMethod = filters.grouping || (viewMode === 'planner' ? 'none' : 'tag');
    
    if (groupingMethod === 'none') {
      return null; // No grouping, return flat list
    }
    
    if (groupingMethod === 'status') {
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
    }
    
    if (groupingMethod === 'priority') {
      const grouped: { [key: string]: Task[] } = {
        'Urgent': [],
        'High': [],
        'Normal': [],
        'Low': []
      };
      
      tasks.forEach(task => {
        if (task.priority === 'urgent') {
          grouped['Urgent'].push(task);
        } else if (task.priority === 'high') {
          grouped['High'].push(task);
        } else if (task.priority === 'normal') {
          grouped['Normal'].push(task);
        } else if (task.priority === 'low') {
          grouped['Low'].push(task);
        }
      });
      
      return grouped;
    }
    
    if (groupingMethod === 'tag') {
      const grouped: { [key: string]: Task[] } = {};
      tasks.forEach(task => {
        const tagName = task.tag_name || 'Unassigned';
        if (!grouped[tagName]) {
          grouped[tagName] = [];
        }
        grouped[tagName].push(task);
      });
      return grouped;
    }
    
    return null;
  }, [tasks, filters.grouping, viewMode]);

  // Get sorted group names
  const sortedGroupNames = useMemo(() => {
    if (!groupedTasks) return [];
    
    const groupingMethod = filters.grouping || (viewMode === 'planner' ? 'none' : 'tag');
    
    if (groupingMethod === 'status') {
      return ['In Progress & Paused', 'To Do', 'Completed'];
    }
    
    if (groupingMethod === 'priority') {
      return ['Urgent', 'High', 'Normal', 'Low'];
    }
    
    if (groupingMethod === 'tag') {
      return Object.keys(groupedTasks).sort((a, b) => {
        if (a === 'Unassigned') return -1;
        if (b === 'Unassigned') return 1;
        return a.localeCompare(b);
      });
    }
    
    return [];
  }, [groupedTasks, filters.grouping, viewMode]);

  // Get group ID for expansion tracking
  const getGroupId = useCallback((groupName: string) => {
    const groupingMethod = filters.grouping || (viewMode === 'planner' ? 'none' : 'tag');
    
    if (groupingMethod === 'status') {
      if (groupName === 'In Progress & Paused') return 1;
      if (groupName === 'To Do') return 2;
      if (groupName === 'Completed') return 3;
    }
    
    if (groupingMethod === 'priority') {
      if (groupName === 'Urgent') return 1;
      if (groupName === 'High') return 2;
      if (groupName === 'Normal') return 3;
      if (groupName === 'Low') return 4;
    }
    
    if (groupingMethod === 'tag') {
      if (groupName === 'Unassigned') return -1;
      return tags.find(t => t.name === groupName)?.id || 0;
    }
    
    return 0;
  }, [filters.grouping, viewMode, tags]);

  // Check if group is expanded
  const isGroupExpanded = useCallback((groupName: string) => {
    const groupingMethod = filters.grouping || (viewMode === 'planner' ? 'none' : 'tag');
    const groupId = getGroupId(groupName);
    
    // Special handling for completed tasks in status grouping
    if (groupingMethod === 'status' && groupName === 'Completed') {
      return filters.show_completed && expandedTags.has(groupId);
    }
    
    return expandedTags.has(groupId);
  }, [filters.grouping, viewMode, filters.show_completed, expandedTags, getGroupId]);

  // Toggle group expansion
  const toggleGroupExpansion = useCallback((groupName: string) => {
    const groupId = getGroupId(groupName);
    const newExpanded = new Set(expandedTags);
    
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedTags(newExpanded);
  }, [expandedTags, getGroupId]);

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
        
        // Update local state instead of reloading
        setTasks(prevTasks => {
          const updatedTasks = prevTasks.map(t => 
            t.id === taskId ? { ...t, status: newStatus } as Task : t
          );
          return updatedTasks;
        });
      } else {
        // In tracker view, we're moving between tag groups
        const tagId = targetId === -1 ? undefined : targetId;
        const targetTagName = targetId === -1 ? 'Unassigned' : tags.find(t => t.id === targetId)?.name || 'Unknown';
        
        console.log(`📦 Moving task "${task.title}" to tag: ${task.tag_name || 'Unassigned'} → ${targetTagName}`);
        await apiService.updateTask(taskId, { tag_id: tagId });
        
        // Update local state instead of reloading
        setTasks(prevTasks => {
          const updatedTasks = prevTasks.map(t => 
            t.id === taskId ? { ...t, tag_id: tagId, tag_name: targetTagName } as Task : t
          );
          return updatedTasks;
        });
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleTitleClick = (task: Task) => {
    setEditingTitleTaskId(task.id);
    setEditingTitleValue(task.title);
    
    // Close description tooltip when editing title
    setVisibleTooltips(prev => {
      const newSet = new Set(prev);
      newSet.delete(task.id);
      return newSet;
    });
    
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
      
      // Update local state instead of reloading
      setTasks(prevTasks => {
        const updatedTasks = prevTasks.map(t => 
          t.id === taskId ? { ...t, title: editingTitleValue.trim() } as Task : t
        );
        return updatedTasks;
      });
      
      // Clear position cache for this task to force recalculation of tooltip position
      positionCache.current.delete(taskId);
      maxWidthCache.current.delete(taskId);
      
      // Recheck title truncation for this task
      setTimeout(() => {
        checkTitleTruncation(taskId);
      }, 100);
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
    
    setIsCreatingTag(true);
    try {
      console.log(`➕ Creating new tag: "${newTagName.trim()}"`);
      const newTag = await apiService.createTag(newTagName.trim(), selectedWorkspaceId);
      setNewTagName('');
      setShowTagInput(false);
      
      // Add new tag to local state
      setTags(prevTags => [...prevTags, newTag]);
    } catch (error) {
      console.error('Error creating tag:', error);
    } finally {
      setIsCreatingTag(false);
    }
  };

  const handleTagSave = async (taskId: number, tagId?: number) => {
    try {
      // Use provided tagId or fall back to editingTagValue
      const finalTagId = tagId !== undefined ? tagId : (editingTagValue ? Number(editingTagValue) : undefined);
      const tagName = finalTagId ? tags.find(t => t.id === finalTagId)?.name || 'Unknown' : 'Unassigned';
      console.log(`🏷️ Updating task tag: "${tagName}"`);
      await apiService.updateTask(taskId, { tag_id: finalTagId });
      
      // Update local state instead of reloading
      setTasks(prevTasks => {
        const updatedTasks = prevTasks.map(t => {
          if (t.id === taskId) {
            return {
              ...t,
              tag_id: finalTagId,
              tag_name: tagName
            } as Task;
          }
          return t;
        });
        return updatedTasks;
      });
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

  const formatDateForInput = (dateString: string | undefined) => {
    if (!dateString) return '';
    try {
      // Handle ISO date strings (2025-07-12T04:00:00.000Z) and convert to YYYY-MM-DD
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        // If it's not a valid ISO date, try to parse as YYYY-MM-DD
        const datePart = dateString.split(' ')[0]; // Get just the date part
        return datePart;
      }
      return date.toISOString().split('T')[0]; // Convert to YYYY-MM-DD
    } catch {
      return '';
    }
  };

  const handleDateClick = (task: Task, dateType: 'due_date' | 'start_date' | 'completion_date') => {
    setEditingDateTaskId(task.id);
    setEditingDateType(dateType);
    setEditingDateValue(formatDateForInput(task[dateType]));
    // Focus the input after a brief delay to ensure it's rendered
    setTimeout(() => {
      dateInputRef.current?.focus();
      dateInputRef.current?.showPicker?.(); // Show native date picker immediately
    }, 10);
  };

  // Handle mobile date picker reset functionality
  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>, taskId: number) => {
    const newValue = e.target.value;
    setEditingDateValue(newValue);
    
    // For mobile, also handle the case where the date picker is closed without a selection
    // This helps with the "Reset" button functionality
    if (!newValue) {
      // If the value is empty, it means the date was cleared (Reset button pressed)
      setTimeout(() => {
        handleDateSave(taskId);
      }, 100); // Small delay to ensure the picker is fully closed
    }
  };

  // Enhanced date change handler that works better with mobile date pickers
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>, taskId: number) => {
    const newValue = e.target.value;
    setEditingDateValue(newValue);
    
    // For mobile date pickers, handle the reset functionality
    if (!newValue) {
      // When the value is empty (Reset button pressed), save immediately
      setTimeout(() => {
        handleDateSave(taskId);
      }, 150); // Slightly longer delay for mobile picker to fully close
    }
  };

  const handleDateSave = async (taskId: number) => {
    if (!editingDateType) return;
    
    try {
      // Validate the date value before saving
      let dateValue: string | null = editingDateValue;
      if (dateValue && dateValue.trim() !== '') {
        // Ensure the date is in YYYY-MM-DD format
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) {
          console.error('Invalid date value:', dateValue);
          return;
        }
        dateValue = date.toISOString().split('T')[0]; // Convert to YYYY-MM-DD
      } else {
        dateValue = null;
      }
      
      console.log(`📅 Updating task ${editingDateType}: "${dateValue}"`);
      await apiService.updateTask(taskId, { [editingDateType]: dateValue });
      
      // Reload the task data from server to ensure correct format
      const updatedTask = await apiService.getTask(taskId);
      setTasks(prevTasks => {
        const updatedTasks = prevTasks.map(t => {
          if (t.id === taskId) {
            return updatedTask;
          }
          return t;
        });
        return updatedTasks;
      });
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
    if (!dateString || dateString === '') return '';
    
    try {
      // Handle different date formats
      let year: number, month: number, day: number;
      
      if (dateString.includes('-')) {
        // YYYY-MM-DD format
        const parts = dateString.split('-').map(Number);
        if (parts.length !== 3 || parts.some(isNaN)) {
          return '';
        }
        [year, month, day] = parts;
      } else if (dateString.includes('/')) {
        // MM/DD/YYYY format (fallback)
        const parts = dateString.split('/').map(Number);
        if (parts.length !== 3 || parts.some(isNaN)) {
          return '';
        }
        [month, day, year] = parts;
      } else {
        // Invalid format
        return '';
      }
      
      // Validate date components
      if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
        return '';
      }
      
      // Create a local date (not UTC) to avoid timezone shifts
      const localDate = new Date(year, month - 1, day);
      
      // Validate the created date
      if (isNaN(localDate.getTime())) {
        return '';
      }
      
      return format(localDate, 'MMM d');
    } catch (error) {
      console.error('formatDate error:', error, 'for dateString:', dateString);
      return '';
    }
  };

  const handleDescriptionSave = async (taskId: number, description: string) => {
    try {
      console.log(`📝 Updating task description: "${description}"`);
      
      // If description is empty or just whitespace, set it to undefined
      const finalDescription = description.trim() || undefined;
      
      await apiService.updateTask(taskId, { description: finalDescription });
      
      // Update local state instead of reloading
      setTasks(prevTasks => 
        prevTasks.map(t => t.id === taskId ? { ...t, description: finalDescription } as Task : t)
      );
      
      // If description is now blank, show chat icon instead of tooltip
      if (!finalDescription) {
        setVisibleTooltips(prev => {
          const newSet = new Set(prev);
          newSet.delete(taskId);
          return newSet;
        });
        setChatIcons(prev => new Set(prev).add(taskId));
        setEditingTooltips(prev => {
          const newSet = new Set(prev);
          newSet.delete(taskId);
          return newSet;
        });
      } else {
        // Clear editing state when description is saved
        setEditingTooltips(prev => {
          const newSet = new Set(prev);
          newSet.delete(taskId);
          return newSet;
        });
      }
    } catch (error) {
      console.error('Error updating task description:', error);
      throw error;
    }
  };

  const handleDescriptionTooltipClose = () => {
    setVisibleTooltips(new Set());
    setChatIcons(new Set());
    setEditingTooltips(new Set());
  };

  const handleChatIconClick = (taskId: number) => {
    // Clear any existing timer
    const existingTimer = tooltipTimers.get(taskId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      setTooltipTimers(prev => {
        const newMap = new Map(prev);
        newMap.delete(taskId);
        return newMap;
      });
    }

    // Hide chat icon and show tooltip in editing mode
    setChatIcons(prev => {
      const newSet = new Set(prev);
      newSet.delete(taskId);
      return newSet;
    });
    setVisibleTooltips(prev => new Set(prev).add(taskId));
    setEditingTooltips(prev => new Set(prev).add(taskId));
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

    // Check if task has a description
    const task = tasks.find(t => t.id === taskId);
    if (task && !task.description) {
      // Show chat icon for blank descriptions
      setChatIcons(prev => new Set(prev).add(taskId));
    } else {
      // Show tooltip for tasks with descriptions
      setVisibleTooltips(prev => new Set(Array.from(prev).concat([taskId])));
    }
  };

  const hideTooltip = (taskId: number) => {
    // Set a timer to hide the tooltip/chat icon after 800ms
    const timer = setTimeout(() => {
      setVisibleTooltips(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
      
      setChatIcons(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
      
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

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, taskId: number) => {
    e.preventDefault();
    
    // Position the context menu appropriately for all screen sizes
    const isSmallScreen = window.innerWidth < 640; // sm breakpoint
    let x = e.clientX;
    let y = e.clientY;
    
    if (isSmallScreen) {
      // For small screens, position the menu to the right of the three-dot button
      const menuWidth = 150; // Approximate menu width
      const menuHeight = 80; // Approximate menu height
      
      // Position to the right of the button
      x = Math.min(x + 20, window.innerWidth - menuWidth - 10);
      
      // Position below the button, but ensure it doesn't go off screen
      y = Math.min(y + 10, window.innerHeight - menuHeight - 10);
    }
    
    setContextMenu({
      visible: true,
      x,
      y,
      taskId
    });
  };

  const handleContextMenuClose = () => {
    setContextMenu({
      visible: false,
      x: 0,
      y: 0,
      taskId: null
    });
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      await apiService.deleteTask(taskId);
      
      // Update local state instead of reloading
      setTasks(prevTasks => {
        const updatedTasks = prevTasks.filter(t => t.id !== taskId);
        return updatedTasks;
      });
      handleContextMenuClose();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  // Expose sort function to parent component
  useImperativeHandle(ref, () => ({
    sortTasks: () => {
      console.log('🔄 Manually sorting tasks...');
      const sortedTasks = sortTasks(tasks);
      setTasks(sortedTasks);
      console.log('✅ Tasks sorted successfully');
    },
    getTasks: () => tasks
  }), [tasks, sortTasks]);

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-2">
      {/* New task input */}
      <div className="flex items-center gap-3 p-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 shadow-sm">
        <Plus className="w-5 h-5 text-blue-500" />
        <div className="relative">
          <div
            className="text-sm rounded-md px-3 py-1.5 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-32 md:w-44 cursor-pointer bg-white hover:bg-gray-50 transition-colors min-h-[32px] flex items-center"
            onClick={(e) => {
              e.stopPropagation();
              setShowNewTaskTagDropdown(!showNewTaskTagDropdown);
            }}
            title="Select tag for new task"
          >
            <span className="text-gray-600">
              {selectedNewTaskTag[selectedWorkspaceId] ? (tags.find(t => t.id.toString() === selectedNewTaskTag[selectedWorkspaceId])?.name || 'Select tag') : 'Select tag'}
            </span>
          </div>
          
          {/* New task tag dropdown menu */}
          {showNewTaskTagDropdown && (
            <div 
              className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 mt-1"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="max-h-60 overflow-y-auto">
                <div 
                  className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50 cursor-pointer border-b"
                  onClick={() => {
                    setSelectedNewTaskTag(prev => ({ ...prev, [selectedWorkspaceId]: '' }));
                    setShowNewTaskTagDropdown(false);
                  }}
                >
                  No tag
                </div>
                {tags.filter(tag => tag.hidden !== true).map((tag) => (
                  <div
                    key={tag.id}
                    className={clsx(
                      "px-3 py-1.5 text-sm cursor-pointer hover:bg-blue-50 transition-colors",
                      selectedNewTaskTag[selectedWorkspaceId] === tag.id.toString() && "bg-blue-100 text-blue-700"
                    )}
                    onClick={() => {
                      setSelectedNewTaskTag(prev => ({ ...prev, [selectedWorkspaceId]: tag.id.toString() }));
                      setShowNewTaskTagDropdown(false);
                    }}
                  >
                    {tag.name}
                  </div>
                ))}
                <div className="border-t border-gray-200">
                  <div 
                    className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => {
                      setShowTagEditModal(true);
                      setShowNewTaskTagDropdown(false);
                    }}
                  >
                    Edit tags
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <input
          ref={newTaskInputRef}
          type="text"
          placeholder="Add new task..."
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isCreatingTask}
          className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
        />
      </div>

      {/* Unified Task List Layout */}
      {groupedTasks ? (
        // Grouped layout
        sortedGroupNames.map((groupName) => (
          <div key={groupName} className="border rounded">
            {/* Group header */}
            <div 
              className="flex items-center justify-between p-3 bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors"
              onClick={() => toggleGroupExpansion(groupName)}
            >
              <div className="flex items-center space-x-2">
                {isGroupExpanded(groupName) ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                <span className="font-medium text-sm">{groupName === 'Unassigned' ? 'Unassigned' : groupName}</span>
                <span className="text-xs text-gray-500">({groupedTasks?.[groupName]?.length || 0})</span>
              </div>
            </div>

            {/* Tasks in group */}
            {isGroupExpanded(groupName) && (
              <div 
                className="divide-y"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => {
                  const groupId = getGroupId(groupName);
                  if (groupId) {
                    handleDrop(e, groupId);
                  }
                }}
              >
                {/* Column headers */}
                <div className="flex items-center space-x-3 p-3 bg-gray-50 text-xs font-medium text-gray-600 border-b">
                  <div className="w-4"></div> {/* Status */}
                  <div className="w-4"></div> {/* Priority */}
                  <div className="flex-1">Task</div>
                  {viewMode === 'planner' && <div className="w-20 text-center">Tag</div>}
                  <div className="hidden sm:block w-16 text-center">Start</div>
                  {viewMode === 'tracker' && <div className="hidden sm:block w-16 text-center">Complete</div>}
                  <div className="hidden sm:block w-16 text-center">Due</div>
                  <div className="w-3"></div> {/* Three-dot menu space */}
                </div>

                {groupedTasks?.[groupName]?.map((task) => (
                  <TaskRow 
                    key={task.id}
                    task={task}
                    viewMode={viewMode}
                    onContextMenu={handleContextMenu}
                    onDragStart={handleDragStart}
                    editingTitleTaskId={editingTitleTaskId}
                    editingPriorityTaskId={editingPriorityTaskId}
                    editingDateTaskId={editingDateTaskId}
                    editingDateType={editingDateType}
                    editingDateValue={editingDateValue}
                    editingTitleValue={editingTitleValue}
                    editingPriorityValue={editingPriorityValue}
                    editingTagTaskId={editingTagTaskId}
                    editingTagValue={editingTagValue}
                    visibleTooltips={visibleTooltips}
                    hoveredTask={hoveredTask}
                    chatIcons={chatIcons}
                    editingTooltips={editingTooltips}
                    titleRefs={titleRefs}
                    statusClickTimers={statusClickTimers}
                    tags={tags}
                    onStatusClick={handleStatusClick}
                    onStatusDoubleClick={handleStatusDoubleClick}
                    onPriorityClick={handlePriorityClick}
                    onPrioritySave={handlePrioritySave}
                    onPriorityKeyPress={handlePriorityKeyPress}
                    onTitleClick={handleTitleClick}
                    onTitleSave={handleTitleSave}
                    onTitleCancel={handleTitleCancel}
                    onTitleKeyPress={handleTitleKeyPress}
                    onDateClick={handleDateClick}
                    onDateSave={handleDateSave}
                    onDateKeyPress={handleDateKeyPress}
                    onTagClick={(taskId: number) => setEditingTagTaskId(taskId)}
                    onTagSave={handleTagSave}
                    onTagCancel={handleTagCancel}
                    onTagKeyPress={handleTagKeyPress}
                    onDescriptionSave={handleDescriptionSave}
                    onDescriptionTooltipClose={handleDescriptionTooltipClose}
                    onChatIconClick={handleChatIconClick}
                    onShowTooltip={showTooltip}
                    onHideTooltip={hideTooltip}
                    onSetEditingTitleValue={setEditingTitleValue}
                    onSetEditingPriorityValue={setEditingPriorityValue}
                    onSetEditingDateValue={setEditingDateValue}
                    onSetEditingTagValue={setEditingTagValue}
                    onSetEditingDateType={setEditingDateType}
                    onSetEditingTitleTaskId={setEditingTitleTaskId}
                    onSetEditingPriorityTaskId={setEditingPriorityTaskId}
                    onSetEditingDateTaskId={setEditingDateTaskId}
                    onSetEditingTagTaskId={setEditingTagTaskId}
                    onSetHoveredTask={setHoveredTask}
                    onSetEditingTooltips={setEditingTooltips}
                    titleInputRef={titleInputRef}
                    dateInputRef={dateInputRef}
                    formatDate={formatDate}
                    getStatusIcon={getStatusIcon}
                    getStatusColor={getStatusColor}
                    getPriorityIcon={getPriorityIcon}
                    checkTitleTruncation={checkTitleTruncation}
                    getTitleEndPosition={getTitleEndPosition}
                    getTitleEndPositionStyle={getTitleEndPositionStyle}
                    getMaxTooltipWidth={getMaxTooltipWidth}
                  />
                ))}
              </div>
            )}
          </div>
        ))
      ) : (
        // Flat list layout (no grouping)
        <div className="border rounded">
          {/* Column headers */}
          <div className="flex items-center space-x-3 p-3 bg-gray-50 text-xs font-medium text-gray-600 border-b">
            <div className="w-4"></div> {/* Status */}
            <div className="w-4"></div> {/* Priority */}
            <div className="flex-1">Task</div>
            {viewMode === 'planner' && <div className="w-20 text-center">Tag</div>}
            <div className="hidden sm:block w-16 text-center">Start</div>
            {viewMode === 'tracker' && <div className="hidden sm:block w-16 text-center">Complete</div>}
            <div className="hidden sm:block w-16 text-center">Due</div>
            <div className="w-3"></div> {/* Three-dot menu space */}
          </div>
          
          {/* All tasks in single list */}
          <div className="divide-y">
            {tasks.map((task) => (
              <TaskRow 
                key={task.id}
                task={task}
                viewMode={viewMode}
                onContextMenu={handleContextMenu}
                onDragStart={handleDragStart}
                editingTitleTaskId={editingTitleTaskId}
                editingPriorityTaskId={editingPriorityTaskId}
                editingDateTaskId={editingDateTaskId}
                editingDateType={editingDateType}
                editingDateValue={editingDateValue}
                editingTitleValue={editingTitleValue}
                editingPriorityValue={editingPriorityValue}
                editingTagTaskId={editingTagTaskId}
                editingTagValue={editingTagValue}
                visibleTooltips={visibleTooltips}
                hoveredTask={hoveredTask}
                chatIcons={chatIcons}
                editingTooltips={editingTooltips}
                titleRefs={titleRefs}
                statusClickTimers={statusClickTimers}
                tags={tags}
                onStatusClick={handleStatusClick}
                onStatusDoubleClick={handleStatusDoubleClick}
                onPriorityClick={handlePriorityClick}
                onPrioritySave={handlePrioritySave}
                onPriorityKeyPress={handlePriorityKeyPress}
                onTitleClick={handleTitleClick}
                onTitleSave={handleTitleSave}
                onTitleCancel={handleTitleCancel}
                onTitleKeyPress={handleTitleKeyPress}
                onDateClick={handleDateClick}
                onDateSave={handleDateSave}
                onDateKeyPress={handleDateKeyPress}
                onTagClick={(taskId) => setEditingTagTaskId(taskId)}
                onTagSave={handleTagSave}
                onTagCancel={handleTagCancel}
                onTagKeyPress={handleTagKeyPress}
                onDescriptionSave={handleDescriptionSave}
                onDescriptionTooltipClose={handleDescriptionTooltipClose}
                onChatIconClick={handleChatIconClick}
                onShowTooltip={showTooltip}
                onHideTooltip={hideTooltip}
                onSetEditingTitleValue={setEditingTitleValue}
                onSetEditingPriorityValue={setEditingPriorityValue}
                onSetEditingDateValue={setEditingDateValue}
                onSetEditingTagValue={setEditingTagValue}
                onSetEditingDateType={setEditingDateType}
                onSetEditingTitleTaskId={setEditingTitleTaskId}
                onSetEditingPriorityTaskId={setEditingPriorityTaskId}
                onSetEditingDateTaskId={setEditingDateTaskId}
                onSetEditingTagTaskId={setEditingTagTaskId}
                onSetHoveredTask={setHoveredTask}
                onSetEditingTooltips={setEditingTooltips}
                titleInputRef={titleInputRef}
                dateInputRef={dateInputRef}
                formatDate={formatDate}
                getStatusIcon={getStatusIcon}
                getStatusColor={getStatusColor}
                getPriorityIcon={getPriorityIcon}
                checkTitleTruncation={checkTitleTruncation}
                getTitleEndPosition={getTitleEndPosition}
                getTitleEndPositionStyle={getTitleEndPositionStyle}
                getMaxTooltipWidth={getMaxTooltipWidth}
              />
            ))}
          </div>
        </div>
      )}

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
          onUpdate={(updatedTask) => {
            // Update local state for autosave operations
            setTasks(prevTasks => 
              prevTasks.map(t => t.id === updatedTask.id ? updatedTask : t)
            );
            // Also update the editingTask state to keep modal in sync
            setEditingTask(updatedTask);
          }}
          onTagSave={handleTagSave}
        />
      )}

      {/* Tag Edit Modal */}
      {showTagEditModal && (
        <TagEditModal
          tags={tags}
          workspaceId={selectedWorkspaceId}
          onClose={() => setShowTagEditModal(false)}
          onTagsUpdate={loadData}
        />
      )}

      {/* Context Menu */}
      {contextMenu.visible && contextMenu.taskId && (
        <div
          className="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            minWidth: '150px',
            maxWidth: '200px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              const task = tasks.find(t => t.id === contextMenu.taskId);
              if (task) {
                setEditingTask(task);
              }
              handleContextMenuClose();
            }}
            className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 flex items-center space-x-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>Edit Task</span>
          </button>
          <button
            onClick={() => handleDeleteTask(contextMenu.taskId!)}
            className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 active:bg-red-100 flex items-center space-x-2 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Task</span>
          </button>
        </div>
      )}
    </div>
  );
});

export default TaskList; 