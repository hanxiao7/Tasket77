import React, { useRef } from 'react';

interface DatePickerProps {
  value: string | undefined;
  onChange: (date: string | null) => void;
  children: React.ReactNode; // The existing styled field
  disabled?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}

const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  children,
  disabled,
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
    onChange(newValue || null);
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
      className="relative inline-block"
      onClick={handleContainerClick}
    >
      {/* Hidden native date input for functionality */}
      <input
        ref={inputRef}
        type="date"
        value={formattedValue}
        onChange={handleChange}
        onFocus={onFocus}
        onBlur={onBlur}
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