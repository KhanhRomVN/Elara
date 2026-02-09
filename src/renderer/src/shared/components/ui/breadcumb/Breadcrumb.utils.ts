import { CSSProperties } from 'react';
import { BreadcrumbSize } from './Breadcrumb.types';

/**
 * Get breadcrumb size styles based on size percentage
 */
export const getBreadcrumbSizeStyles = (size: BreadcrumbSize): CSSProperties => {
  const scale = size / 100;
  const baseFontSize = 14;
  const fontSize = baseFontSize * scale;

  return {
    fontSize: `${fontSize}px`,
    lineHeight: 1.5,
  };
};

/**
 * Get icon size based on breadcrumb size
 */
export const getIconSize = (size: BreadcrumbSize): number => {
  const scale = size / 100;
  return Math.round(16 * scale);
};
