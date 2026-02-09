import { CSSProperties } from 'react';
import { ButtonSize, ButtonWidth, ButtonAlign, ButtonIcon } from './Button.types';

/**
 * Get button size styles based on size percentage
 */
export const getButtonSizeStyles = (
  size: ButtonSize,
  width: ButtonWidth,
  hasText: boolean,
  hasIcon: boolean,
): CSSProperties => {
  const scale = size / 100;

  // Base dimensions at 100% scale
  const baseHeight = 40;
  const basePaddingX = 16;
  const basePaddingY = 8;
  const baseFontSize = 14;
  const baseBorderRadius = 6;
  const baseGap = 8;

  // Calculate scaled values
  const height = baseHeight * scale;
  const paddingX = basePaddingX * scale;
  const paddingY = basePaddingY * scale;
  const fontSize = baseFontSize * scale;
  const borderRadius = baseBorderRadius * scale;
  const gap = baseGap * scale;

  // Adjust padding for icon-only buttons
  const finalPaddingX = hasIcon && !hasText ? Math.min(paddingX, height / 3) : paddingX;
  const finalPaddingY = hasIcon && !hasText ? Math.min(paddingY, height / 3) : paddingY;

  return {
    height: `${height}px`,
    padding: `${finalPaddingY}px ${finalPaddingX}px`,
    fontSize: `${fontSize}px`,
    borderRadius: `${borderRadius}px`,
    gap: `${gap}px`,
    width: width === 'full' ? '100%' : 'fit-content',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    outline: 'none',
    transition: 'all 0.2s ease-in-out',
    fontFamily: 'inherit',
    fontWeight: 500,
    lineHeight: 1,
    whiteSpace: 'nowrap' as const,
  };
};

/**
 * Get icon size based on button size and whether there's text
 */
export const getIconSize = (size: ButtonSize, hasText: boolean): number => {
  const scale = size / 100;

  // Base icon sizes
  const baseSizeWithText = 16;
  const baseSizeIconOnly = 20;

  const baseSize = hasText ? baseSizeWithText : baseSizeIconOnly;
  return Math.max(Math.round(baseSize * scale), 12); // Minimum 12px
};

/**
 * Get loading spinner component
 */
export const getLoadingSpinner = (
  size: ButtonSize,
  hasText: boolean,
): { icon: string; size: number } => {
  const iconSize = getIconSize(size, hasText);

  return {
    icon: 'Loader2',
    size: iconSize,
  };
};

/**
 * Check if icon should be shown
 */
export const shouldShowIcon = (icon: ButtonIcon | undefined, loading: boolean): boolean => {
  return !!(icon || loading);
};

/**
 * Get content alignment styles
 */
export const getContentAlignment = (align: ButtonAlign): CSSProperties => {
  switch (align) {
    case 'left':
      return { justifyContent: 'flex-start' };
    case 'center':
      return { justifyContent: 'center' };
    case 'right':
      return { justifyContent: 'flex-end' };
    default:
      return { justifyContent: 'flex-end' };
  }
};

/**
 * Parse custom className for additional styles
 */
export const parseClassName = (className: string): string => {
  return `button-base ${className}`.trim();
};

/**
 * Validate button props
 */
export const validateButtonProps = (props: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (props.size && (props.size < 50 || props.size > 200)) {
    errors.push('Size should be between 50% and 200%');
  }

  if (props.loadingText && !props.loading) {
    errors.push('loadingText should only be used when loading is true');
  }

  if (props.iconPosition !== 'left' && !props.icon) {
    errors.push('iconPosition should only be used when icon is provided');
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
