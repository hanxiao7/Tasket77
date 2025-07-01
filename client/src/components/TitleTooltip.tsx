import React from 'react';

interface TitleTooltipProps {
  title: string;
  titleRef?: HTMLDivElement | null;
}

const TitleTooltip: React.FC<TitleTooltipProps> = ({ title, titleRef }) => {
  // Calculate what part of the title is truncated
  const getTruncatedPart = () => {
    if (!titleRef) return title;
    
    // Create a temporary span to measure the actual text width
    const tempSpan = document.createElement('span');
    tempSpan.style.position = 'absolute';
    tempSpan.style.visibility = 'hidden';
    tempSpan.style.whiteSpace = 'nowrap';
    tempSpan.style.fontSize = window.getComputedStyle(titleRef).fontSize;
    tempSpan.style.fontFamily = window.getComputedStyle(titleRef).fontFamily;
    tempSpan.style.fontWeight = window.getComputedStyle(titleRef).fontWeight;
    tempSpan.textContent = title;
    
    document.body.appendChild(tempSpan);
    const fullTextWidth = tempSpan.offsetWidth;
    document.body.removeChild(tempSpan);
    
    // If text fits within the container, no need for tooltip
    if (fullTextWidth <= titleRef.clientWidth) {
      return '';
    }
    
    // Measure the width of the ellipsis
    tempSpan.textContent = '...';
    document.body.appendChild(tempSpan);
    const ellipsisWidth = tempSpan.offsetWidth;
    document.body.removeChild(tempSpan);
    
    // Available width for text (container width minus ellipsis width)
    const availableWidth = titleRef.clientWidth - ellipsisWidth;
    
    // Find where the text gets cut off, accounting for ellipsis
    let startIndex = 0;
    let endIndex = title.length;
    let lastValidIndex = 0;
    
    // Binary search to find the cutoff point
    while (startIndex <= endIndex) {
      const midIndex = Math.floor((startIndex + endIndex) / 2);
      tempSpan.textContent = title.substring(0, midIndex);
      
      document.body.appendChild(tempSpan);
      const partialWidth = tempSpan.offsetWidth;
      document.body.removeChild(tempSpan);
      
      if (partialWidth <= availableWidth) {
        lastValidIndex = midIndex;
        startIndex = midIndex + 1;
      } else {
        endIndex = midIndex - 1;
      }
    }
    
    // Add a small buffer to account for browser rendering differences
    // Try a few characters less to ensure we don't miss any
    let adjustedIndex = Math.max(0, lastValidIndex - 2);
    
    // Verify this still fits
    tempSpan.textContent = title.substring(0, adjustedIndex);
    document.body.appendChild(tempSpan);
    const adjustedWidth = tempSpan.offsetWidth;
    document.body.removeChild(tempSpan);
    
    if (adjustedWidth <= availableWidth) {
      lastValidIndex = adjustedIndex;
    }
    
    // Return only the truncated part
    return title.substring(lastValidIndex);
  };
  
  const truncatedPart = getTruncatedPart();
  
  if (!truncatedPart) {
    return null; // Don't show tooltip if nothing is truncated
  }
  
  return (
    <div className="absolute z-50 left-0 top-full bg-gray-50 text-gray-800 text-sm px-1 py-1 w-full whitespace-pre-wrap break-words border-t border-gray-200 font-bold">
      {truncatedPart}
    </div>
  );
};

export default TitleTooltip; 