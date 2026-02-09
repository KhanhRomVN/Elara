import { InputSize } from './Input.types';
import { LucideIcon } from 'lucide-react';

/**
 * Get input size classes based on size variant
 */
export const getInputSizeClasses = (size: InputSize = 'md'): string => {
  const sizeMap: Record<InputSize, string> = {
    sm: 'h-8 text-xs px-2 py-1',
    md: 'h-10 text-sm px-3 py-2',
    lg: 'h-12 text-base px-4 py-2.5',
    xl: 'h-14 text-lg px-5 py-3',
  };

  return sizeMap[size];
};

/**
 * Get icon size based on input size
 */
export const getIconSize = (size: InputSize = 'md'): number => {
  const sizeMap: Record<InputSize, number> = {
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
  };

  return sizeMap[size];
};

/**
 * Check if left icon should be shown
 */
export const shouldShowLeftIcon = (
  icon: React.ReactNode | LucideIcon | undefined,
  loading: boolean,
): boolean => {
  return !!(icon || loading);
};

/**
 * Check if right icons should be shown
 */
export const shouldShowRightIcons = (
  icons: React.ReactNode | LucideIcon | (React.ReactNode | LucideIcon)[] | undefined,
): boolean => {
  if (Array.isArray(icons)) {
    return icons.length > 0;
  }
  return !!icons;
};

/**
 * Normalize right icons to array
 */
export const normalizeRightIcons = (
  icons: React.ReactNode | LucideIcon | (React.ReactNode | LucideIcon)[] | undefined,
): (React.ReactNode | LucideIcon)[] => {
  if (!icons) return [];
  return Array.isArray(icons) ? icons : [icons];
};
