import React, { useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface DatePickerProps {
  value: string | undefined;
  onChange: (date: string | null) => void;
  children: React.ReactNode; // The existing styled field
  disabled?: boolean;
  className?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  showClearButton?: boolean; // New prop to control clear button visibility
  mobileOnly?: boolean; // New prop to show clear button only on mobile
}

const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  children,
  disabled,
  className = '',
  onFocus,
  onBlur,
  showClearButton = true, // Default to showing clear button
  mobileOnly = false, // Default to showing on all devices
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Format value to YYYY-MM-DD for native date input
  const formatDateForInput = (dateString: string | undefined) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        const datePart = dateString.split(' ')[0];
        return datePart;
      }
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue || null);
  };

  // Handle blur event
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (onBlur) {
      onBlur();
    }
  };

  const handleContainerClick = () => {
    if (inputRef.current && !disabled) {
      inputRef.current.focus();
      if (inputRef.current.showPicker) {
        try {
          inputRef.current.showPicker();
        } catch (error) {
          console.log('showPicker not supported or failed:', error);
        }
      }
    }
  };

  // Clear button handler
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the date picker
    onChange(null);
  };

  const formattedValue = formatDateForInput(value);

  return (
    <div 
      ref={containerRef}
      className={`relative inline-block ${className}`}
      onClick={handleContainerClick}
    >
      {/* Hidden native date input for functionality */}
      <input
        ref={inputRef}
        type="date"
        value={formattedValue}
        onChange={handleChange}
        onFocus={onFocus}
        onBlur={handleBlur}
        disabled={disabled}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        style={{
          position: 'absolute',
          zIndex: 2,
        }}
      />
      
      {/* The existing styled field - no changes to its appearance */}
      {children}
      
      {/* Clear button - only show when there's a value and showClearButton is true */}
      {showClearButton && value && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          className={`absolute right-0 top-1/2 transform -translate-y-1/2 z-10 p-1 text-gray-400 hover:text-gray-600 transition-colors ${
            mobileOnly ? 'md:hidden' : ''
          }`}
          title="Clear date"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

export default DatePicker; 