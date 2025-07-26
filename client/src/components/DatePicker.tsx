import React, { useRef, useEffect } from 'react';

interface DatePickerProps {
  value: string | undefined;
  onChange: (date: string | null) => void;
  children: React.ReactNode; // The existing styled field
  disabled?: boolean;
  className?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}

const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  children,
  disabled,
  className = '',
  onFocus,
  onBlur,
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
    alert(`📅 DatePicker onChange: "${newValue}"`);
    onChange(newValue || null);
  };

  // Enhanced mobile reset handling
  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    alert(`📅 DatePicker onInput: "${target.value}"`);
    
    // On mobile, when Reset is pressed, the value becomes empty
    if (!target.value) {
      alert('📅 Mobile Reset detected - clearing date');
      onChange(null);
    }
  };

  // Handle blur event to catch mobile reset
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    alert(`📅 DatePicker onBlur: "${e.target.value}"`);
    
    // If the value is empty on blur, it might be from a mobile reset
    if (!e.target.value && value) {
      alert('📅 Mobile Reset detected on blur - clearing date');
      onChange(null);
    }
    
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
        onInput={handleInput}
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
    </div>
  );
};

export default DatePicker; 