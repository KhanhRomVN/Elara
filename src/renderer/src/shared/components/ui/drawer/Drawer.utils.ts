import { CSSProperties } from 'react';
import { DrawerDirection, DrawerAnimationType, DrawerSize } from './Drawer.types';

/**
 * Convert fraction string to percentage
 * @example parseSize("1/2") => "50%"
 * @example parseSize(400) => "400px"
 * @example parseSize("33%") => "33%"
 */
export const parseSize = (size: DrawerSize | undefined, defaultValue: string): string => {
  if (!size) return defaultValue;

  if (typeof size === 'number') {
    return `${size}px`;
  }

  // Handle fractions like "1/2", "1/3", "1/4"
  if (size.includes('/')) {
    const [numerator, denominator] = size.split('/').map(Number);
    if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
      return `${(numerator / denominator) * 100}%`;
    }
  }

  // Handle special values
  if (size === 'full') return '100%';
  if (size === 'screen') return '100vw';
  if (size === 'auto') return 'auto';

  return size;
};

/**
 * Get animation variants based on direction and animation type
 */
export const getDrawerVariants = (
  direction: DrawerDirection,
  animationType: DrawerAnimationType,
): any => {
  const baseVariants: Record<string, any> = {
    slide: {
      hidden: {
        x: direction === 'right' ? '100%' : direction === 'left' ? '-100%' : 0,
        y: direction === 'top' ? '-100%' : direction === 'bottom' ? '100%' : 0,
      },
      visible: { x: 0, y: 0 },
    },
    scale: {
      hidden: { scale: 0.8, opacity: 0 },
      visible: { scale: 1, opacity: 1 },
    },
    fade: {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
    },
    bounce: {
      hidden: {
        x: direction === 'right' ? '100%' : direction === 'left' ? '-100%' : 0,
        y: direction === 'top' ? '-100%' : direction === 'bottom' ? '100%' : 0,
        scale: 0.8,
      },
      visible: {
        x: 0,
        y: 0,
        scale: 1,
        transition: {
          type: 'spring',
          damping: 15,
          stiffness: 300,
        },
      },
    },
    elastic: {
      hidden: {
        x: direction === 'right' ? '100%' : direction === 'left' ? '-100%' : 0,
        y: direction === 'top' ? '-100%' : direction === 'bottom' ? '100%' : 0,
      },
      visible: {
        x: 0,
        y: 0,
        transition: {
          type: 'spring',
          damping: 20,
          stiffness: 100,
          mass: 0.8,
        },
      },
    },
  };

  return baseVariants[animationType] || baseVariants.slide;
};

/**
 * Animation variants for overlay
 */
export const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

/**
 * Get drawer positioning styles based on direction
 */
export const getDrawerPosition = (
  direction: DrawerDirection,
  width: DrawerSize | undefined,
  height: DrawerSize | undefined,
): CSSProperties => {
  const baseStyle: CSSProperties = {
    position: 'fixed',
    zIndex: 1000,
  };

  switch (direction) {
    case 'right': {
      const drawerWidth = parseSize(width, '400px');
      return {
        ...baseStyle,
        top: 0,
        right: 0,
        width: drawerWidth,
        height: '100%',
      };
    }

    case 'left': {
      const drawerWidth = parseSize(width, '400px');
      return {
        ...baseStyle,
        top: 0,
        left: 0,
        width: drawerWidth,
        height: '100%',
      };
    }

    case 'top': {
      const drawerHeight = parseSize(height, '400px');
      return {
        ...baseStyle,
        top: 0,
        left: 0,
        width: '100%',
        height: drawerHeight,
      };
    }

    case 'bottom': {
      const drawerHeight = parseSize(height, '400px');
      return {
        ...baseStyle,
        bottom: 0,
        left: 0,
        width: '100%',
        height: drawerHeight,
      };
    }

    default:
      return baseStyle;
  }
};
