import { CSSProperties } from 'react';

/**
 * Get tab indicator position style
 */
export const getIndicatorStyle = (
  activeIndex: number,
  itemCount: number,
  containerWidth: number,
): CSSProperties => {
  const itemWidth = containerWidth / itemCount;
  const leftPosition = itemWidth * activeIndex;

  return {
    width: `${itemWidth}px`,
    transform: `translateX(${leftPosition}px)`,
  };
};

/**
 * Get tab item width based on width mode
 */
export const getItemWidthClass = (widthMode: 'full' | 'fit'): string => {
  return widthMode === 'full' ? 'flex-1 text-center' : 'px-6';
};

/**
 * Check if tab item should be highlighted
 */
export const shouldHighlightTab = (
  tabId: string,
  activeTab: string,
  highlightOnHover: boolean = true,
): boolean => {
  return tabId === activeTab || highlightOnHover;
};
