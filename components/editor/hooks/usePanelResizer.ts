// FIX: Import MouseEvent from React.
import { useState, useCallback, useRef, RefObject, MouseEvent, Dispatch, SetStateAction } from 'react';

export const MIN_PANEL_PERCENTAGE = 5;

interface UsePanelResizerProps {
  initialWidths: number[];
  minPercentage: number;
  mainContentAreaRef: RefObject<HTMLDivElement>;
}

interface UsePanelResizerReturn {
  panelWidths: number[];
  handleMouseDownOnResizer: (
    // FIX: Use MouseEvent instead of React.MouseEvent
    event: MouseEvent<HTMLDivElement>,
    resizerIndex: number
  ) => void;
  hoveredResizer: number | null;
  // FIX: Import Dispatch and SetStateAction to resolve React namespace error.
  setHoveredResizer: Dispatch<SetStateAction<number | null>>;
}

export const usePanelResizer = ({
  initialWidths,
  minPercentage,
  mainContentAreaRef,
}: UsePanelResizerProps): UsePanelResizerReturn => {
  const [panelWidths, setPanelWidths] = useState<number[]>(initialWidths);
  const [hoveredResizer, setHoveredResizer] = useState<number | null>(null);

  const dragStateRef = useRef<{
    activeResizerIndex: null | number;
    startX: number;
    initialWidths: number[];
  } | null>(null);

  const handleMouseMove = useCallback((event: globalThis.MouseEvent) => {
    if (dragStateRef.current === null || !mainContentAreaRef.current) return;

    const { activeResizerIndex, startX, initialWidths: iWidths } = dragStateRef.current;
    if (activeResizerIndex === null) return;
    
    const mainContentWidth = mainContentAreaRef.current.offsetWidth;
    if (mainContentWidth === 0) return;

    const dx = event.clientX - startX;
    const deltaPercent = (dx / mainContentWidth) * 100;
    
    const leftPanelIndex = activeResizerIndex;
    const rightPanelIndex = activeResizerIndex + 1;

    const totalTwoPanelWidth = iWidths[leftPanelIndex] + iWidths[rightPanelIndex];

    let newLeftWidth = iWidths[leftPanelIndex] + deltaPercent;
    
    // Clamp the new left width to ensure neither panel goes below the minimum percentage
    newLeftWidth = Math.max(minPercentage, newLeftWidth);
    newLeftWidth = Math.min(totalTwoPanelWidth - minPercentage, newLeftWidth);

    const newRightWidth = totalTwoPanelWidth - newLeftWidth;

    const newWidths = [...iWidths];
    newWidths[leftPanelIndex] = newLeftWidth;
    newWidths[rightPanelIndex] = newRightWidth;

    setPanelWidths(newWidths);

  }, [mainContentAreaRef, minPercentage]);
  

  const handleMouseUp = useCallback(() => {
    dragStateRef.current = null;
    document.body.style.cursor = '';
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDownOnResizer = (
    // FIX: Use MouseEvent instead of React.MouseEvent
    event: MouseEvent<HTMLDivElement>,
    resizerIndex: number
  ) => {
    event.preventDefault();
    dragStateRef.current = {
      activeResizerIndex: resizerIndex,
      startX: event.clientX,
      initialWidths: panelWidths,
    };
    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return {
    panelWidths,
    handleMouseDownOnResizer,
    hoveredResizer,
    setHoveredResizer,
  };
};