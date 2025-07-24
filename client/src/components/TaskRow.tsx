import React from 'react';
import { Task, Tag } from '../types';
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

interface TaskRowProps {
  task: Task;
  viewMode: 'planner' | 'tracker';
  onContextMenu: (e: React.MouseEvent, taskId: number) => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  editingTitleTaskId: number | null;
  editingPriorityTaskId: number | null;
  editingDateTaskId: number | null;
  editingDateType: 'due_date' | 'start_date' | 'completion_date' | null;
  editingDateValue: string;
  editingTitleValue: string;
  editingPriorityValue: Task['priority'];
  editingTagTaskId: number | null;
  editingTagValue: string;
  visibleTooltips: Set<number>;
  hoveredTask: number | null;
  chatIcons: Set<number>;
  editingTooltips: Set<number>;
  titleRefs: React.MutableRefObject<Map<number, HTMLDivElement | null>>;
  statusClickTimers: React.MutableRefObject<{ [taskId: number]: NodeJS.Timeout }>;
  tags: Tag[];
  onStatusClick: (task: Task) => void;
  onStatusDoubleClick: (task: Task) => void;
  onPriorityClick: (task: Task) => void;
  onPrioritySave: (taskId: number) => void;
  onPriorityKeyPress: (e: React.KeyboardEvent, taskId: number) => void;
  onTitleClick: (task: Task) => void;
  onTitleSave: (taskId: number) => void;
  onTitleCancel: () => void;
  onTitleKeyPress: (e: React.KeyboardEvent, taskId: number) => void;
  onDateClick: (task: Task, dateType: 'due_date' | 'start_date' | 'completion_date') => void;
  onDateSave: (taskId: number) => void;
  onDateKeyPress: (e: React.KeyboardEvent, taskId: number) => void;
  onTagClick: (taskId: number) => void;
  onTagSave: (taskId: number, tagId?: number) => void;
  onTagCancel: () => void;
  onTagKeyPress: (e: React.KeyboardEvent, taskId: number) => void;
  onDescriptionSave: (taskId: number, description: string) => Promise<void>;
  onDescriptionTooltipClose: () => void;
  onChatIconClick: (taskId: number) => void;
  onShowTooltip: (taskId: number) => void;
  onHideTooltip: (taskId: number) => void;
  onSetEditingTitleValue: (value: string) => void;
  onSetEditingPriorityValue: (value: Task['priority']) => void;
  onSetEditingDateValue: (value: string) => void;
  onSetEditingTagValue: (value: string) => void;
  onSetEditingDateType: (value: 'due_date' | 'start_date' | 'completion_date' | null) => void;
  onSetEditingTitleTaskId: (value: number | null) => void;
  onSetEditingPriorityTaskId: (value: number | null) => void;
  onSetEditingDateTaskId: (value: number | null) => void;
  onSetEditingTagTaskId: (value: number | null) => void;
  onSetHoveredTask: (value: number | null) => void;
  onSetEditingTooltips: (value: Set<number>) => void;
  titleInputRef: React.RefObject<HTMLInputElement>;
  dateInputRef: React.RefObject<HTMLInputElement>;
  formatDate: (dateString: string | undefined) => string;
  getStatusIcon: (status: Task['status']) => React.ReactNode;
  getStatusColor: (status: Task['status']) => string;
  getPriorityIcon: (priority: Task['priority']) => React.ReactNode;
  checkTitleTruncation: (taskId: number) => void;
  getTitleEndPosition: (taskId: number) => "right" | "end-of-title" | "end-of-content";
  getTitleEndPositionStyle: (taskId: number) => React.CSSProperties;
  getMaxTooltipWidth: (taskId: number) => number;
}

const TaskRow: React.FC<TaskRowProps> = ({
  task,
  viewMode,
  onContextMenu,
  onDragStart,
  editingTitleTaskId,
  editingPriorityTaskId,
  editingDateTaskId,
  editingDateType,
  editingDateValue,
  editingTitleValue,
  editingPriorityValue,
  editingTagTaskId,
  editingTagValue,
  visibleTooltips,
  hoveredTask,
  chatIcons,
  editingTooltips,
  titleRefs,
  statusClickTimers,
  tags,
  onStatusClick,
  onStatusDoubleClick,
  onPriorityClick,
  onPrioritySave,
  onPriorityKeyPress,
  onTitleClick,
  onTitleSave,
  onTitleCancel,
  onTitleKeyPress,
  onDateClick,
  onDateSave,
  onDateKeyPress,
  onTagClick,
  onTagSave,
  onTagCancel,
  onTagKeyPress,
  onDescriptionSave,
  onDescriptionTooltipClose,
  onChatIconClick,
  onShowTooltip,
  onHideTooltip,
  onSetEditingTitleValue,
  onSetEditingPriorityValue,
  onSetEditingDateValue,
  onSetEditingTagValue,
  onSetEditingDateType,
  onSetEditingTitleTaskId,
  onSetEditingPriorityTaskId,
  onSetEditingDateTaskId,
  onSetEditingTagTaskId,
  onSetHoveredTask,
  onSetEditingTooltips,
  titleInputRef,
  dateInputRef,
  formatDate,
  getStatusIcon,
  getStatusColor,
  getPriorityIcon,
  checkTitleTruncation,
  getTitleEndPosition,
  getTitleEndPositionStyle,
  getMaxTooltipWidth
}) => {
  const setTitleRef = (taskId: number, ref: HTMLDivElement | null) => {
    titleRefs.current.set(taskId, ref);
  };

  return (
    <div
      className="flex items-center space-x-3 p-3 hover:bg-gray-50 relative"
      onContextMenu={(e) => onContextMenu(e, task.id)}
      draggable={editingTitleTaskId !== task.id}
      onDragStart={(e) => onDragStart(e, task)}
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

      {/* Tag */}
      {viewMode === 'planner' && (
        <div className="flex-shrink-0 w-20 text-center relative">
          <div
            className={clsx(
              "text-xs rounded px-1 py-1 w-full transition-all cursor-pointer min-h-[20px] flex items-center justify-center",
              editingTagTaskId === task.id 
                ? "border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500" 
                : "border border-transparent hover:border-gray-300 hover:bg-blue-50"
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (editingTagTaskId !== task.id) {
                onTagClick(task.id);
                onSetEditingTagValue(task.tag_id?.toString() || '');
              } else {
                onSetEditingTagTaskId(null);
              }
            }}
            title="Click to edit tag"
          >
            {task.tag_name ? (
              <span className="text-sm font-medium">{task.tag_name}</span>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </div>
          
          {/* Tag dropdown menu */}
          {editingTagTaskId === task.id && (
            <div 
              className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 mt-1"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="max-h-40 overflow-y-auto">
                <div 
                  className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 cursor-pointer border-b"
                  onClick={() => {
                    onSetEditingTagValue('');
                    onTagSave(task.id, undefined);
                    onSetEditingTagTaskId(null);
                  }}
                >
                  No tag
                </div>
                {tags.filter(tag => tag.hidden !== true).map((tag) => (
                  <div
                    key={tag.id}
                    className={clsx(
                      "px-2 py-1 text-xs cursor-pointer hover:bg-blue-50 transition-colors",
                      editingTagValue === tag.id.toString() && "bg-blue-100 text-blue-700"
                    )}
                    onClick={() => {
                      onSetEditingTagValue(tag.id.toString());
                      onTagSave(task.id, tag.id);
                      onSetEditingTagTaskId(null);
                    }}
                  >
                    {tag.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Start date */}
      <div className="hidden sm:flex flex-shrink-0 w-16 justify-center">
        {editingDateTaskId === task.id && editingDateType === 'start_date' ? (
          <input
            ref={dateInputRef}
            type="date"
            value={editingDateValue}
            onChange={(e) => {
              onSetEditingDateValue(e.target.value);
              // Handle mobile date picker reset
              if (!e.target.value) {
                setTimeout(() => onDateSave(task.id), 150);
              }
            }}
            onInput={(e) => {
              // Additional handler for mobile date picker reset
              const target = e.target as HTMLInputElement;
              if (!target.value) {
                setTimeout(() => onDateSave(task.id), 200);
              }
            }}
            onKeyPress={(e) => onDateKeyPress(e, task.id)}
            onBlur={() => onDateSave(task.id)}
            className="text-xs border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
            title="Press Enter to save, Escape to cancel"
          />
        ) : (
          <div 
            className="flex items-center justify-center text-xs text-gray-500 cursor-pointer hover:text-blue-600 hover:bg-blue-50 px-1 py-1 rounded min-h-[20px]"
            onClick={(e) => {
              e.stopPropagation();
              onDateClick(task, 'start_date');
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
        <div className="hidden sm:flex flex-shrink-0 w-16 justify-center">
          {editingDateTaskId === task.id && editingDateType === 'completion_date' ? (
            <input
              ref={dateInputRef}
              type="date"
              value={editingDateValue}
              onChange={(e) => {
                onSetEditingDateValue(e.target.value);
                // Handle mobile date picker reset
                if (!e.target.value) {
                  setTimeout(() => onDateSave(task.id), 150);
                }
              }}
              onInput={(e) => {
                // Additional handler for mobile date picker reset
                const target = e.target as HTMLInputElement;
                if (!target.value) {
                  setTimeout(() => onDateSave(task.id), 200);
                }
              }}
              onKeyPress={(e) => onDateKeyPress(e, task.id)}
              onBlur={() => onDateSave(task.id)}
              className="text-xs border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
              title="Press Enter to save, Escape to cancel"
            />
          ) : (
            <div 
              className="flex items-center justify-center text-xs text-gray-500 cursor-pointer hover:text-blue-600 hover:bg-blue-50 px-1 py-1 rounded min-h-[20px]"
              onClick={(e) => {
                e.stopPropagation();
                onDateClick(task, 'completion_date');
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
      <div className="hidden sm:flex flex-shrink-0 w-16 justify-center">
        {editingDateTaskId === task.id && editingDateType === 'due_date' ? (
          <input
            ref={dateInputRef}
            type="date"
            value={editingDateValue}
            onChange={(e) => {
              onSetEditingDateValue(e.target.value);
              // Handle mobile date picker reset
              if (!e.target.value) {
                setTimeout(() => onDateSave(task.id), 150);
              }
            }}
            onInput={(e) => {
              // Additional handler for mobile date picker reset
              const target = e.target as HTMLInputElement;
              if (!target.value) {
                setTimeout(() => onDateSave(task.id), 200);
              }
            }}
            onKeyPress={(e) => onDateKeyPress(e, task.id)}
            onBlur={() => onDateSave(task.id)}
            className="text-xs border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
            title="Press Enter to save, Escape to cancel"
          />
        ) : (
          <div 
            className="flex items-center justify-center text-xs text-gray-500 cursor-pointer hover:text-blue-600 hover:bg-blue-50 px-1 py-1 rounded min-h-[20px]"
            onClick={(e) => {
              e.stopPropagation();
              onDateClick(task, 'due_date');
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

      {/* Three-dot menu */}
      <div className="flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(e, task.id);
          }}
          className="p-0 rounded hover:bg-gray-100 transition-colors"
          title="More options"
        >
          <MoreVertical className="w-2.5 h-2.5 text-gray-500" />
        </button>
      </div>
    </div>
  );
};

export default TaskRow; 