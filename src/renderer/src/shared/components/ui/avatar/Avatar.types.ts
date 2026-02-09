import { ReactNode } from 'react';

/**
 * Kích thước avatar (pixel)
 */
export type AvatarSize = number;

/**
 * Hình dạng avatar
 */
export type AvatarShape = 'circle' | 'square' | 'rounded';

/**
 * Icon hiển thị trong dot (có thể là icon component, svg, emoji...)
 */
export type AvatarIcon = React.ReactNode;

/**
 * Loại fallback khi không có ảnh
 */
export type AvatarFallbackType = 'icon' | 'initials';

/**
 * Props chính của Avatar component
 */
export interface AvatarProps {
  /** Kích thước avatar (pixel) */
  size?: AvatarSize;

  /** URL ảnh */
  src?: string;

  /** Alt text cho ảnh */
  alt?: string;

  /** Tên để tạo initials */
  name?: string;

  /** Icon hiển thị chính ở Avatar (thay thế image/initials) */
  icon?: AvatarIcon;

  /** Icon hiển thị trong dot */
  dotIcon?: AvatarIcon;

  /** Màu nền của dot chứa icon */
  dotBgColor?: string;

  /** Hình dạng avatar */
  shape?: AvatarShape;

  /** Custom class name */
  className?: string;

  /** Loại fallback khi không có ảnh */
  fallbackType?: AvatarFallbackType;

  /** Click handler */
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;

  /** Các props HTML div khác */
  [key: string]: any;
}

/**
 * Interface cho avatar size configuration
 */
export interface AvatarSizeConfig {
  /** Chiều rộng và chiều cao */
  size: string;

  /** Border radius */
  borderRadius: string;

  /** Font size */
  fontSize: string;
}

/**
 * Interface cho icon dot configuration
 */
export interface AvatarIconDotConfig {
  /** Kích thước dot */
  size: number;

  /** Màu nền dot */
  backgroundColor: string;

  /** Vị trí dot */
  position: {
    bottom: number;
    right: number;
  };
}
