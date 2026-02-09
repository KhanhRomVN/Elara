import { ReactNode } from 'react';

/**
 * Kích thước badge (percentage scale)
 */
export type BadgeSize = number;

/**
 * Variant của badge
 */
export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'error'
  | 'outline'
  | 'kbd';

/**
 * Props chính của Badge component
 */
export interface BadgeProps {
  /** Nội dung badge */
  children?: ReactNode;

  /** Loại badge */
  variant?: BadgeVariant;

  /** Kích thước badge */
  size?: BadgeSize;

  /** Hiển thị dot indicator */
  dot?: boolean;

  /** Màu custom cho dot */
  dotColor?: string;

  /** Custom class name */
  className?: string;

  /** Các props HTML span khác */
  [key: string]: any;
}

/**
 * Interface cho badge size configuration
 */
export interface BadgeSizeConfig {
  /** Padding horizontal */
  paddingX: string;

  /** Padding vertical */
  paddingY: string;

  /** Font size */
  fontSize: string;

  /** Border radius */
  borderRadius: string;

  /** Line height */
  lineHeight: number;
}

/**
 * Interface cho badge variant styles
 */
export interface BadgeVariantStyles {
  /** Background color */
  backgroundColor: string;

  /** Text color */
  color: string;

  /** Border color */
  borderColor?: string;

  /** Border width */
  borderWidth?: string;
}
