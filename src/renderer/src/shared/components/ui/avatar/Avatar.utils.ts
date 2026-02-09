import { CSSProperties } from 'react';
import { AvatarSize, AvatarShape } from './Avatar.types';

/**
 * Get avatar size styles based on size and shape
 */
export const getAvatarSizeStyles = (size: AvatarSize, shape: AvatarShape): CSSProperties => {
  let borderRadius: string;

  switch (shape) {
    case 'circle':
      borderRadius = '50%';
      break;
    case 'square':
      borderRadius = '4px';
      break;
    case 'rounded':
      borderRadius = '20%';
      break;
    default:
      borderRadius = '50%';
  }

  return {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius,
  };
};

/**
 * Get dot size based on avatar size
 */
export const getDotSize = (avatarSize: AvatarSize): number => {
  if (avatarSize <= 24) return 12;
  if (avatarSize <= 32) return 14;
  if (avatarSize <= 48) return 16;
  if (avatarSize <= 64) return 18;
  if (avatarSize <= 96) return 20;
  return 24;
};

/**
 * Get dot position based on avatar size and dot size
 */
export const getDotPosition = (
  avatarSize: AvatarSize,
  dotSize: number,
): { bottom: number; right: number } => {
  const offset = Math.max(dotSize * 0.2, 1);
  return {
    bottom: offset,
    right: offset,
  };
};

/**
 * Get initials from name
 */
export const getInitials = (name: string): string => {
  if (!name) return '?';

  const names = name.trim().split(/\s+/);

  if (names.length === 1) {
    return names[0].charAt(0).toUpperCase();
  }

  return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
};

/**
 * Get fallback background color based on name
 */
export const getFallbackBackground = (name?: string): string => {
  if (!name) return '#6B7280';

  // Simple hash function for consistent color based on name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  const colors = [
    '#EF4444', // red
    '#F59E0B', // amber
    '#10B981', // emerald
    '#3B82F6', // blue
    '#8B5CF6', // violet
    '#EC4899', // pink
    '#06B6D4', // cyan
    '#84CC16', // lime
  ];

  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

/**
 * Get default dot background color
 */
export const getDefaultDotBgColor = (): string => {
  return '#10B981'; // green default
};

/**
 * Get icon size for dot based on dot size
 */
export const getDotIconSize = (dotSize: number): number => {
  return Math.max(Math.floor(dotSize * 0.5), 6);
};

/**
 * Validate avatar props
 */
export const validateAvatarProps = (props: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (props.size && (props.size < 16 || props.size > 200)) {
    errors.push('Size should be between 16px and 200px');
  }

  if (props.fallbackType === 'initials' && !props.name) {
    errors.push("Name is required when fallbackType is 'initials'");
  }

  if (props.src && !props.alt && !props.name) {
    errors.push('Alt text or name is recommended when using src');
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
