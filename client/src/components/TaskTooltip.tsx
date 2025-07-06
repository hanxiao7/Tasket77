import React, { useState, useRef, useEffect } from 'react';
import { X, Edit3, Save, RotateCcw } from 'lucide-react';
import clsx from 'clsx';

interface TaskTooltipProps {
  description: string;
  taskId: number;
  onSave: (taskId: number, description: string) => Promise<void>;
  onClose: () => void;
  position?: 'right' | 'end-of-title' | 'end-of-content';
  positionStyle?: React.CSSProperties;
  maxWidth?: number;
}

const TaskTooltip: React.FC<TaskTooltipProps> = ({ 
  description, 
  taskId, 
  onSave, 
  onClose,
  position = 'right',
  positionStyle,
  maxWidth = 1100
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(description);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipWidth, setTooltipWidth] = useState(200);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const minHeight = 60; // Minimum height
      const maxHeight = 200; // Maximum height before scrolling
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`;
    }
  }, [editValue, isEditing]);

  // Expand to max width when editing starts
  useEffect(() => {
    if (isEditing && maxWidth) {
      setTooltipWidth(maxWidth);
    }
  }, [isEditing, maxWidth]);

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(editValue.length, editValue.length);
    }
  }, [isEditing, editValue.length]);

  const handleSave = async () => {
    if (editValue.trim() === description) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(taskId, editValue.trim());
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving description:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(description);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditing) {
      setIsEditing(true);
    }
  };

  const handleMouseLeave = () => {
    // Auto-save when mouse leaves the tooltip
    if (isEditing && editValue.trim() !== description) {
      handleSave();
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <div 
      ref={tooltipRef}
      className={clsx(
        "absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg top-0 min-w-[200px] select-text",
        position === 'right' ? "left-full ml-2 max-w-[400px]" : ""
      )}
      style={{
        width: `${tooltipWidth}px`,
        ...(positionStyle || {})
      }}
      onClick={handleClick}
      onMouseLeave={handleMouseLeave}
    >


      {/* Content */}
      <div className="p-3">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            placeholder="Enter task description..."
            className="w-full resize-none border-none outline-none text-sm text-gray-700 bg-transparent placeholder-gray-400 select-text"
            style={{ minHeight: '30px', maxHeight: '200px' }}
            draggable={false}
          />
        ) : (
          <div 
            className={clsx(
              "text-sm whitespace-pre-wrap break-words select-text",
              description ? "text-gray-700 min-h-[30px]" : "text-gray-300 min-h-[30px] flex items-center justify-center italic"
            )}
            style={{ 
              maxHeight: '200px',
              overflowY: description && description.length > 200 ? 'auto' : 'visible'
            }}
          >
            {description || "Click to add description..."}
          </div>
        )}
      </div>

      {/* Arrow */}
      <div className={clsx(
        "absolute top-4 transform -translate-x-1 w-2 h-2 bg-white border-l border-t border-gray-200 rotate-45",
        position === 'right' ? "left-0" : 
        position === 'end-of-title' ? "right-0" :
        "left-0"
      )}></div>
    </div>
  );
};

export default TaskTooltip; 