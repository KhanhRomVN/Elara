import React from 'react';
import { User } from 'lucide-react';
import { AvatarProps } from './Avatar.types';
import {
  getAvatarSizeStyles,
  getInitials,
  getFallbackBackground,
  getDotSize,
  getDotPosition,
  getDotIconSize,
} from './Avatar.utils';
import { cn } from '../../../../shared/utils/cn';

const Avatar: React.FC<AvatarProps> = ({
  size = 40,
  src,
  alt,
  name,
  icon,
  dotIcon,
  dotBgColor,
  shape = 'circle',
  className = '',
  fallbackType = 'icon',
  onClick,
  ...props
}) => {
  const [imageError, setImageError] = React.useState(false);
  const showImage = src && !imageError && !icon;
  const showFallback = !src && !icon;
  const showIcon = !!icon;

  // Lấy styles dựa trên size và shape
  const sizeStyles = getAvatarSizeStyles(size, shape);

  // Lấy dot styles
  const dotSize = getDotSize(size);
  const dotPosition = getDotPosition(size, dotSize);
  const dotIconSize = getDotIconSize(dotSize);

  // Lấy fallback background color
  const fallbackBackground = getFallbackBackground(name);

  // Xử lý lỗi ảnh
  const handleImageError = () => {
    setImageError(true);
  };

  // Render fallback content
  const renderFallback = () => {
    // Nếu có icon prop, hiển thị icon đó thay vì initials/User icon
    if (showIcon && icon) {
      return icon;
    }

    if (fallbackType === 'initials' && name) {
      const initials = getInitials(name);
      return (
        <span
          className="avatar-initials font-semibold text-white uppercase"
          style={{
            fontSize: `${Math.max(size * 0.4, 12)}px`,
          }}
        >
          {initials}
        </span>
      );
    }

    // Fallback icon
    return <User size={size * 0.5} className="text-white opacity-80" />;
  };

  // Render icon dot
  const renderIconDot = () => {
    if (!dotIcon) return null;

    return (
      <div
        className="absolute rounded-full border flex items-center justify-center"
        style={{
          width: `${dotSize}px`,
          height: `${dotSize}px`,
          backgroundColor: dotBgColor || '#10B981',
          ...dotPosition,
        }}
      >
        {dotIcon}
      </div>
    );
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center flex-shrink-0 select-none',
        onClick ? 'cursor-pointer' : 'cursor-default',
        className,
      )}
      style={{
        ...sizeStyles,
      }}
      onClick={handleClick}
      {...props}
    >
      {/* Avatar Image */}
      {showImage && (
        <img
          src={src}
          alt={alt || name || 'Avatar'}
          className="w-full h-full object-cover rounded-[inherit]"
          onError={handleImageError}
        />
      )}

      {/* Fallback */}
      {(showFallback || showIcon) && (
        <div
          className="w-full h-full rounded-[inherit] flex items-center justify-center"
          style={{
            backgroundColor: fallbackBackground,
          }}
        >
          {renderFallback()}
        </div>
      )}

      {/* Icon Dot */}
      {renderIconDot()}
    </div>
  );
};

export default Avatar;
