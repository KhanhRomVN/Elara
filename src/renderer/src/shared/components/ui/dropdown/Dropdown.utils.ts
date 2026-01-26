import { CSSProperties } from 'react';
import { DropdownPosition, DropdownSize } from './Dropdown.types';

/**
 * Get dropdown size styles
 */
export const getDropdownSizeStyles = (size: DropdownSize) => {
  const sizes = {
    sm: {
      fontSize: '14px',
      padding: '4px',
      itemPadding: '8px 12px',
      gap: '2px',
      iconSize: 14,
    },
    md: {
      fontSize: '14px',
      padding: '6px',
      itemPadding: '10px 14px',
      gap: '4px',
      iconSize: 16,
    },
    lg: {
      fontSize: '16px',
      padding: '8px',
      itemPadding: '12px 16px',
      gap: '6px',
      iconSize: 18,
    },
  };

  return sizes[size];
};

/**
 * Get position styles for dropdown content
 */
export const getPositionStyles = (
  position: DropdownPosition,
  spacing: number = 8,
): CSSProperties => {
  const positions: Record<DropdownPosition, CSSProperties> = {
    // Top positions
    'top-left': {
      bottom: `calc(100% + ${spacing}px)`,
      left: '0',
    },
    'top-center': {
      bottom: `calc(100% + ${spacing}px)`,
      left: '50%',
      transform: 'translateX(-50%)',
    },
    'top-right': {
      bottom: `calc(100% + ${spacing}px)`,
      right: '0',
    },

    // Bottom positions
    'bottom-left': {
      top: `calc(100% + ${spacing}px)`,
      left: '0',
    },
    'bottom-center': {
      top: `calc(100% + ${spacing}px)`,
      left: '50%',
      transform: 'translateX(-50%)',
    },
    'bottom-right': {
      top: `calc(100% + ${spacing}px)`,
      right: '0',
    },

    // Left positions
    'left-top': {
      right: `calc(100% + ${spacing}px)`,
      top: '0',
    },
    'left-center': {
      right: `calc(100% + ${spacing}px)`,
      top: '50%',
      transform: 'translateY(-50%)',
    },
    'left-bottom': {
      right: `calc(100% + ${spacing}px)`,
      bottom: '0',
    },

    // Right positions
    'right-top': {
      left: `calc(100% + ${spacing}px)`,
      top: '0',
    },
    'right-center': {
      left: `calc(100% + ${spacing}px)`,
      top: '50%',
      transform: 'translateY(-50%)',
    },
    'right-bottom': {
      left: `calc(100% + ${spacing}px)`,
      bottom: '0',
    },
  };

  return positions[position];
};

/**
 * Get icon size based on dropdown size
 */
export const getIconSize = (size: DropdownSize): number => {
  const sizeMap: Record<DropdownSize, number> = {
    sm: 14,
    md: 16,
    lg: 18,
  };

  return sizeMap[size];
};
