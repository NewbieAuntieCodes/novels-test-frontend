import { useEffect, useMemo, useRef, useState } from 'react';

export const useVirtualRows = <T,>(items: T[], rowHeight: number, overscan: number = 8) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateViewportHeight = () => {
      setViewportHeight(node.clientHeight);
    };
    const handleScroll = () => {
      setScrollTop(node.scrollTop);
    };

    updateViewportHeight();
    handleScroll();

    node.addEventListener('scroll', handleScroll, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    const supportsResizeObserver = typeof ResizeObserver !== 'undefined';
    if (supportsResizeObserver) {
      resizeObserver = new ResizeObserver(updateViewportHeight);
      resizeObserver.observe(node);
    } else {
      window.addEventListener('resize', updateViewportHeight);
    }

    return () => {
      node.removeEventListener('scroll', handleScroll);
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', updateViewportHeight);
      }
    };
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const maxScrollTop = Math.max(0, items.length * rowHeight - viewportHeight);
    if (node.scrollTop > maxScrollTop) {
      node.scrollTop = maxScrollTop;
      setScrollTop(maxScrollTop);
    }
  }, [items.length, rowHeight, viewportHeight]);

  const virtualState = useMemo(() => {
    const safeViewportHeight = viewportHeight > 0 ? viewportHeight : rowHeight * 12;
    const totalHeight = items.length * rowHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const visibleCount = Math.ceil(safeViewportHeight / rowHeight) + overscan * 2;
    const endIndex = Math.min(items.length, startIndex + visibleCount);
    const paddingTop = startIndex * rowHeight;
    const paddingBottom = Math.max(0, totalHeight - endIndex * rowHeight);

    return {
      visibleItems: items.slice(startIndex, endIndex),
      startIndex,
      endIndex,
      paddingTop,
      paddingBottom,
      totalHeight,
    };
  }, [items, overscan, rowHeight, scrollTop, viewportHeight]);

  return {
    containerRef,
    ...virtualState,
  };
};
