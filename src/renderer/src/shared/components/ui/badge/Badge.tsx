import React from 'react';
import { BadgeProps } from './Badge.types';
import { getBadgeSizeStyles, getBadgeVariantStyles, shouldShowDot } from './Badge.utils';
import { cn } from '../../../../shared/utils/cn';

const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 100,
  dot = false,
  dotColor,
  className = '',
  ...props
}) => {
  const showDot = shouldShowDot(dot, variant);

  // Get base size styles
  const sizeStyles = getBadgeSizeStyles(size);

  // Get variant-specific styles
  const variantStyles = getBadgeVariantStyles(variant);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap',
        variant === 'kbd' && 'font-mono',
        className,
      )}
      style={{
        ...sizeStyles,
        ...variantStyles,
        ...(variant === 'kbd' && {
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05), 0 1px 0 0 rgba(0, 0, 0, 0.1)',
        }),
      }}
      {...props}
    >
      {showDot && (
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{
            backgroundColor: dotColor || variantStyles.color,
          }}
        />
      )}
      {children}
    </span>
  );
};

export default Badge;
