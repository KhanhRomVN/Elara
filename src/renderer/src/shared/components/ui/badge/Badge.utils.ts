import { CSSProperties } from 'react';
import { BadgeSize, BadgeVariant, BadgeVariantStyles } from './Badge.types';

/**
 * Get badge size styles based on size percentage
 */
export const getBadgeSizeStyles = (size: BadgeSize): CSSProperties => {
  const scale = size / 100;

  // Base dimensions at 100% scale
  const basePaddingX = 8;
  const basePaddingY = 4;
  const baseFontSize = 12;
  const baseBorderRadius = 6;

  // Calculate scaled values
  const paddingX = basePaddingX * scale;
  const paddingY = basePaddingY * scale;
  const fontSize = baseFontSize * scale;
  const borderRadius = baseBorderRadius * scale;

  return {
    padding: `${paddingY}px ${paddingX}px`,
    fontSize: `${fontSize}px`,
    borderRadius: `${borderRadius}px`,
    lineHeight: 1,
  };
};

/**
 * Get badge variant styles
 */
export const getBadgeVariantStyles = (variant: BadgeVariant): BadgeVariantStyles => {
  const styles: { [key in BadgeVariant]: BadgeVariantStyles } = {
    default: {
      backgroundColor: '#f1f5f9',
      color: '#475569',
      borderColor: '#e2e8f0',
      borderWidth: '1px',
    },
    primary: {
      backgroundColor: '#3b82f6',
      color: '#ffffff',
    },
    secondary: {
      backgroundColor: '#6b7280',
      color: '#ffffff',
    },
    success: {
      backgroundColor: '#10b981',
      color: '#ffffff',
    },
    warning: {
      backgroundColor: '#f59e0b',
      color: '#ffffff',
    },
    error: {
      backgroundColor: '#ef4444',
      color: '#ffffff',
    },
    outline: {
      backgroundColor: 'transparent',
      color: '#6b7280',
      borderColor: '#d1d5db',
      borderWidth: '1px',
    },
    kbd: {
      backgroundColor: '#f9fafb',
      color: '#1f2937',
      borderColor: '#d1d5db',
      borderWidth: '1px',
    },
  };

  return styles[variant];
};

/**
 * Check if dot should be shown
 */
export const shouldShowDot = (dot: boolean, variant: BadgeVariant): boolean => {
  return dot && variant !== 'outline';
};

/**
 * Validate badge props
 */
export const validateBadgeProps = (props: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (props.size && (props.size < 50 || props.size > 200)) {
    errors.push('Size should be between 50% and 200%');
  }

  if (props.dotColor && !props.dot) {
    errors.push('dotColor should only be used when dot is true');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Merge custom styles with base styles
 */
export const mergeStyles = (
  baseStyles: CSSProperties,
  customStyles?: CSSProperties,
): CSSProperties => {
  if (!customStyles) return baseStyles;

  return {
    ...baseStyles,
    ...customStyles,
  };
};
