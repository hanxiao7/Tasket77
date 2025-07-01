import React from 'react';

interface TitleTooltipProps {
  title: string;
}

const TitleTooltip: React.FC<TitleTooltipProps> = ({ title }) => {
  return (
    <div className="absolute z-50 left-0 top-full mt-1 bg-amber-50 border border-amber-200 text-gray-800 text-sm rounded px-3 py-2 shadow-md w-full">
      {title}
    </div>
  );
};

export default TitleTooltip; 