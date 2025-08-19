import React from 'react';
import { Task, Category } from '../types';
import { 
  Circle, 
  Play, 
  Pause, 
  CheckCircle, 
  Flag, 
  Calendar,
  ChevronDown,
  ChevronRight,
  MessageSquarePlus,
  MoreVertical
} from 'lucide-react';
import clsx from 'clsx';
import TaskTooltip from './TaskTooltip';
import TitleTooltip from './TitleTooltip';
import DatePicker from './DatePicker';

interface TaskRowProps {
  task: Task;
  viewMode: 'planner' | 'tracker';
  onContextMenu: (e: React.MouseEvent, taskId: number) => void;
  editingTitleTaskId: number | null;
  editingPriorityTaskId: number | null;

  editingTitleValue: string;
  editingPriorityValue: Task['priority'];
  editingCategoryTaskId: number | null;
  editingCategoryValue: string;
  editingAssigneeTaskId: number | null;
  visibleTooltips: Set<number>;
  hoveredTask: number | null;
  chatIcons: Set<number>;
  editingTooltips: Set<number>;
  titleRefs: React.MutableRefObject<Map<number, HTMLDivElement | null>>;
  statusClickTimers: React.MutableRefObject<{ [taskId: number]: NodeJS.Timeout }>;
  categories: Category[];
  onStatusClick: (task: Task) => void;
  onStatusDoubleClick: (task: Task) => void;
  onPriorityClick: (task: Task) => void;
  onPrioritySave: (taskId: number) => void;
  onPriorityKeyPress: (e: React.KeyboardEvent, taskId: number) => void;
  onTitleClick: (task: Task) => void;
  onTitleSave: (taskId: number) => void;
  onTitleCancel: () => void;
  onTitleKeyPress: (e: React.KeyboardEvent, taskId: number) => void;

  onDirectDateSave: (taskId: number, dateType: 'due_date' | 'start_date' | 'completion_date', dateValue: string | null) => Promise<void>;
  onCategoryClick: (taskId: number) => void;
  onCategorySave: (taskId: number, categoryId?: number) => void;
  onCategoryCancel: () => void;
  onCategoryKeyPress: (e: React.KeyboardEvent, taskId: number) => void;
  onDescriptionSave: (taskId: number, description: string) => Promise<void>;
  onDescriptionTooltipClose: () => void;
  onChatIconClick: (taskId: number) => void;
  onShowTooltip: (taskId: number) => void;
  onHideTooltip: (taskId: number) => void;
  onSetEditingTitleValue: (value: string) => void;
  onSetEditingPriorityValue: (value: Task['priority']) => void;
  onSetEditingCategoryValue: (value: string) => void;
  onSetEditingTitleTaskId: (value: number | null) => void;
  onSetEditingPriorityTaskId: (value: number | null) => void;
  onSetEditingCategoryTaskId: (value: number | null) => void;
  onSetEditingAssigneeTaskId: (value: number | null) => void;
  onSetHoveredTask: (value: number | null) => void;
  onSetEditingTooltips: (value: Set<number>) => void;
  onDrop: (e: React.DragEvent, taskId: number) => void;
  titleInputRef: React.RefObject<HTMLInputElement>;

  categoryInputRef: React.RefObject<HTMLSelectElement>;
  onAssigneeClick: (taskId: number) => void;
  onAssigneeSave: (taskId: number, assigneeNames: string[]) => Promise<void>;
  workspaceUsers: Array<{user_id: number, name: string, email: string}>;
  formatDate: (dateString: string | undefined) => string;
  getStatusIcon: (status: Task['status']) => React.ReactNode;
  getStatusColor: (status: Task['status']) => string;
  getPriorityIcon: (priority: Task['priority']) => React.ReactNode;
  checkTitleTruncation: (taskId: number) => void;
  getTitleEndPosition: (taskId: number) => "right" | "end-of-title" | "end-of-content";
  getTitleEndPositionStyle: (taskId: number) => React.CSSProperties;
  getMaxTooltipWidth: (taskId: number) => number;
  selectedTagFilter: string | null;
  setSelectedTagFilter: (tag: string | null) => void;
}

const TaskRow: React.FC<TaskRowProps> = ({
  task,
  viewMode,
  onContextMenu,
  editingTitleTaskId,
  editingPriorityTaskId,

  editingTitleValue,
  editingPriorityValue,
  editingCategoryTaskId,
  editingCategoryValue,
  editingAssigneeTaskId,
  visibleTooltips,
  hoveredTask,
  chatIcons,
  editingTooltips,
  titleRefs,
  statusClickTimers,
  categories,
  onStatusClick,
  onStatusDoubleClick,
  onPriorityClick,
  onPrioritySave,
  onPriorityKeyPress,
  onTitleClick,
  onTitleSave,
  onTitleCancel,
  onTitleKeyPress,

  onDirectDateSave,
  onCategoryClick,
  onCategorySave,
  onCategoryCancel,
  onCategoryKeyPress,
  onDescriptionSave,
  onDescriptionTooltipClose,
  onChatIconClick,
  onShowTooltip,
  onHideTooltip,
  onSetEditingTitleValue,
  onSetEditingPriorityValue,
  onSetEditingCategoryValue,
  onSetEditingTitleTaskId,
  onSetEditingPriorityTaskId,

  onSetEditingCategoryTaskId,
  onSetEditingAssigneeTaskId,
  onSetHoveredTask,
  onSetEditingTooltips,
  onDrop,
  titleInputRef,

  categoryInputRef,
  onAssigneeClick,
  onAssigneeSave,
  workspaceUsers,
  formatDate,
  getStatusIcon,
  getStatusColor,
  getPriorityIcon,
  checkTitleTruncation,
  getTitleEndPosition,
  getTitleEndPositionStyle,
  getMaxTooltipWidth,
  selectedTagFilter,
  setSelectedTagFilter
}) => {
  const setTitleRef = (taskId: number, ref: HTMLDivElement | null) => {
    titleRefs.current.set(taskId, ref);
  };

  return (
    <div
      className="flex items-center space-x-3 p-3 hover:bg-gray-50 relative"
      onContextMenu={(e) => onContextMenu(e, task.id)}
      onDragOver={(e) => {
        e.preventDefault();
        e.currentTarget.classList.add('bg-blue-50', 'border-blue-200');
      }}
      onDragLeave={(e) => {
        e.currentTarget.classList.remove('bg-blue-50', 'border-blue-200');
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('bg-blue-50', 'border-blue-200');
        onDrop(e, task.id);
      }}
    >
      {/* Status button */}
      <div className="w-4 flex justify-center">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            // Start a timer for single click
            if (statusClickTimers.current[task.id]) {
              clearTimeout(statusClickTimers.current[task.id]);
            }
            statusClickTimers.current[task.id] = setTimeout(() => {
              onStatusClick(task);
              delete statusClickTimers.current[task.id];
            }, 250); // 250ms delay to distinguish from double click
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            // If timer exists, cancel single click
            if (statusClickTimers.current[task.id]) {
              clearTimeout(statusClickTimers.current[task.id]);
              delete statusClickTimers.current[task.id];
            }
            onStatusDoubleClick(task);
          }}
          className={clsx(
            "p-0.5 rounded hover:bg-gray-200 transition-colors",
            getStatusColor(task.status)
          )}
          title={`Click to change status, double-click to complete`}
        >
          {getStatusIcon(task.status)}
        </button>
      </div>

      {/* Priority flag */}
      <div className="w-4 flex justify-center">
        {editingPriorityTaskId === task.id ? (
          <select
            value={editingPriorityValue}
            onChange={(e) => onSetEditingPriorityValue(e.target.value as Task['priority'])}
            onKeyPress={(e) => onPriorityKeyPress(e, task.id)}
            onBlur={() => onPrioritySave(task.id)}
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
              onPriorityClick(task);
            }}
            className="p-0.5 rounded hover:bg-gray-200 transition-colors cursor-pointer"
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
            onChange={(e) => onSetEditingTitleValue(e.target.value)}
            onKeyPress={(e) => onTitleKeyPress(e, task.id)}
            onBlur={() => onTitleSave(task.id)}
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
                onTitleClick(task);
              }}
              onMouseEnter={(e) => {
                // Set hovered task immediately for responsive UI
                onSetHoveredTask(task.id);
                
                // Check if title is actually truncated on hover as a fallback
                const target = e.currentTarget;
                const isTruncated = target.scrollWidth > target.clientWidth;
                
                onShowTooltip(task.id);
              }}
              onMouseLeave={(e) => {
                // Check if we're moving to the chat icon or tooltip container
                const relatedTarget = e.relatedTarget as Element | null;
                const isMovingToChatIcon = relatedTarget && typeof relatedTarget.closest === 'function' ? relatedTarget.closest('[data-chat-icon]') : null;
                const isMovingToTooltip = relatedTarget && typeof relatedTarget.closest === 'function' ? relatedTarget.closest('[style*="z-index: 1000"]') : null;
                
                if (isMovingToChatIcon || isMovingToTooltip) {
                  // Don't hide if moving to chat icon or tooltip
                  return;
                }
                
                onSetHoveredTask(null);
                onHideTooltip(task.id);
              }}
            >
                              {task.tag_name && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTagFilter(selectedTagFilter === task.tag_name ? null : (task.tag_name || null));
                    }}
                    className={clsx(
                      "inline-block px-1.5 py-0.5 text-xs rounded border mr-2 transition-colors focus:outline-none",
                      selectedTagFilter === task.tag_name
                        ? "bg-blue-100 border-blue-300 text-blue-700"
                        : "bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100"
                    )}
                    style={{ cursor: 'pointer' }}
                    title={selectedTagFilter === task.tag_name ? 'Show all tasks' : `Show only tasks with tag: ${task.tag_name}`}
                  >
                    {task.tag_name}
                  </button>
                )}
              {task.title}
            </div>
            
            {/* Title Tooltip - show on hover for truncated titles only */}
            {hoveredTask === task.id && (
              <div className="hidden sm:block">
                <TitleTooltip 
                  title={task.title} 
                  titleRef={titleRefs.current.get(task.id)} 
                />
              </div>
            )}
          </div>
        )}
        
        {/* Chat Icon for blank descriptions */}
        {chatIcons.has(task.id) && (
          <div
            data-chat-icon
            className="hidden sm:block"
            style={{ 
              zIndex: 1000
            }}
          >
            <div
              className="absolute top-0 left-0 rounded px-2 py-1 cursor-pointer transition-colors hover:bg-gray-100"
              style={{
                ...getTitleEndPositionStyle(task.id),
                transform: 'translateY(-12px)'
              }}
              onClick={(e) => {
                e.stopPropagation();
                onChatIconClick(task.id);
              }}
              title="Click to add description"
            >
              <MessageSquarePlus className="w-6 h-6 text-gray-600 hover:text-blue-600" />
            </div>
          </div>
        )}
        
        {/* Description Tooltip */}
        {visibleTooltips.has(task.id) && (
          <div
            className="hidden sm:block"
            style={{ 
              zIndex: 1000
            }}
          >
            <TaskTooltip
              description={task.description || ''}
              taskId={task.id}
              onSave={onDescriptionSave}
              onClose={onDescriptionTooltipClose}
              position={getTitleEndPosition(task.id)}
              positionStyle={getTitleEndPositionStyle(task.id)}
              maxWidth={getMaxTooltipWidth(task.id)}
              startEditing={editingTooltips.has(task.id)}
            />
          </div>
        )}
      </div>

      {/* Category */}
      {viewMode === 'planner' && (
        <div className="hidden sm:flex flex-shrink-0 w-24 text-center relative">
          <div
            className={clsx(
              "text-xs rounded px-1 py-1 w-full transition-all cursor-pointer min-h-[20px] flex items-center justify-center",
              editingCategoryTaskId === task.id 
                ? "border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500" 
                : "border border-transparent hover:border-gray-300 hover:bg-blue-50"
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (editingCategoryTaskId !== task.id) {
                onCategoryClick(task.id);
                onSetEditingCategoryValue(task.category_id?.toString() || '');
              } else {
                onSetEditingCategoryTaskId(null);
              }
            }}
            title="Click to edit category"
          >
            {task.category_name ? (
              <span className="text-sm font-medium">{task.category_name}</span>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </div>
          
          {/* Category dropdown menu */}
          {editingCategoryTaskId === task.id && (
            <div 
              className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 mt-1"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="max-h-40 overflow-y-auto">
                <div 
                  className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 cursor-pointer border-b"
                  onClick={() => {
                    onSetEditingCategoryValue('');
                    onCategorySave(task.id, undefined);
                    onSetEditingCategoryTaskId(null);
                  }}
                >
                  No category
                </div>
                {categories.filter(category => category.hidden !== true).map((category) => (
                  <div
                    key={category.id}
                    className={clsx(
                      "px-2 py-1 text-xs cursor-pointer hover:bg-blue-50 transition-colors",
                      editingCategoryValue === category.id.toString() && "bg-blue-100 text-blue-700"
                    )}
                    onClick={() => {
                      onSetEditingCategoryValue(category.id.toString());
                      onCategorySave(task.id, category.id);
                      onSetEditingCategoryTaskId(null);
                    }}
                  >
                    {category.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Assignee */}
      <div className="hidden sm:flex flex-shrink-0 w-24 text-center relative">
        <div
          className={clsx(
            "text-xs rounded px-1 py-1 w-full transition-all cursor-pointer min-h-[20px] flex items-center justify-center",
            editingAssigneeTaskId === task.id 
              ? "border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500" 
              : "border border-transparent hover:border-gray-300 hover:bg-blue-50"
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (editingAssigneeTaskId !== task.id) {
              onAssigneeClick(task.id);
            } else {
              onSetEditingAssigneeTaskId(null);
            }
          }}
          title="Click to edit assignees"
        >
          {task.assignee_names && task.assignee_names.length > 0 ? (
            <span className="text-sm font-medium truncate">
              {task.assignee_names.join(', ')}
            </span>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
        
        {/* Assignee dropdown menu */}
        {editingAssigneeTaskId === task.id && (
          <div 
            className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 mt-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="max-h-40 overflow-y-auto">
              <div 
                className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 cursor-pointer border-b"
                onClick={() => {
                  onAssigneeSave(task.id, []);
                  onSetEditingAssigneeTaskId(null);
                }}
              >
                No assignees
              </div>
              {workspaceUsers.map((user) => (
                <div
                  key={user.user_id}
                  className={clsx(
                    "px-2 py-1 text-xs cursor-pointer hover:bg-blue-50 transition-colors",
                    task.assignee_names?.includes(user.name) && "bg-blue-100 text-blue-700"
                  )}
                  onClick={() => {
                    const currentAssignees = task.assignee_names || [];
                    const isAssigned = currentAssignees.includes(user.name);
                    let newAssignees: string[];
                    
                    if (isAssigned) {
                      // Remove assignee
                      newAssignees = currentAssignees.filter(name => name !== user.name);
                    } else {
                      // Add assignee
                      newAssignees = [...currentAssignees, user.name];
                    }
                    
                    onAssigneeSave(task.id, newAssignees);
                    onSetEditingAssigneeTaskId(null);
                  }}
                >
                  {user.name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Start date */}
      <div className="hidden sm:flex flex-shrink-0 w-12 justify-center">
        <DatePicker
          value={task.start_date}
          onChange={(date: string | null) => {
            onDirectDateSave(task.id, 'start_date', date);
          }}
          mobileOnly={true}
        >
          <div 
            className="flex items-center justify-center text-xs text-gray-500 cursor-pointer hover:text-blue-600 hover:bg-blue-50 px-1 py-1 rounded min-h-[20px]"
            title="Click to set start date"
          >
            {task.start_date ? (
              <span>{formatDate(task.start_date)}</span>
            ) : (
              <Calendar className="w-3 h-3" />
            )}
          </div>
        </DatePicker>
      </div>

      {/* Completion date - only show in tracker view */}
      {viewMode === 'tracker' && (
        <div className="hidden sm:flex flex-shrink-0 w-12 justify-center">
          <DatePicker
            value={task.completion_date}
            onChange={(date: string | null) => {
              onDirectDateSave(task.id, 'completion_date', date);
            }}
            mobileOnly={true}
          >
            <div 
              className="flex items-center justify-center text-xs text-gray-500 cursor-pointer hover:text-blue-600 hover:bg-blue-50 px-1 py-1 rounded min-h-[20px]"
              title="Click to set completion date"
            >
              {task.completion_date ? (
                <span>{formatDate(task.completion_date)}</span>
              ) : (
                <Calendar className="w-3 h-3" />
              )}
            </div>
          </DatePicker>
        </div>
      )}

      {/* Due date */}
      <div className="hidden sm:flex flex-shrink-0 w-12 justify-center">
        <DatePicker
          value={task.due_date}
          onChange={(date: string | null) => {
            onDirectDateSave(task.id, 'due_date', date);
          }}
          mobileOnly={true}
        >
          <div 
            className="flex items-center justify-center text-xs text-gray-500 cursor-pointer hover:text-blue-600 hover:bg-blue-50 px-1 py-1 rounded min-h-[20px]"
            title="Click to set due date"
          >
            {task.due_date ? (
              <span>{formatDate(task.due_date)}</span>
            ) : (
              <Calendar className="w-3 h-3" />
            )}
          </div>
        </DatePicker>
      </div>

      {/* Three-dot menu */}
      <div className="flex-shrink-0 flex items-center justify-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(e, task.id);
          }}
          className="p-0 rounded hover:bg-gray-100 transition-colors"
          title="More options"
        >
          <MoreVertical className="w-4 h-4 text-gray-500" />
        </button>
      </div>
    </div>
  );
};

export default TaskRow; 