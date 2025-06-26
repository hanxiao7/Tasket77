import React from 'react';

interface TaskTooltipProps {
  description: string;
}

const TaskTooltip: React.FC<TaskTooltipProps> = ({ description }) => {
  return (
    <div className="absolute z-50 left-full ml-2 top-0 bg-gray-900 text-white text-xs rounded p-2 max-w-xs shadow-lg">
      {description}
      <div className="absolute left-0 top-2 transform -translate-x-1 w-2 h-2 bg-gray-900 rotate-45"></div>
    </div>
  );
};

export default TaskTooltip; 