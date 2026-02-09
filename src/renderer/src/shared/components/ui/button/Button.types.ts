import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

/**
 * Kích thước button (percentage scale)
 * 100 = 100% (mặc định), 100.5 = 100.5%, 110 = 110%, etc.
 */
export type ButtonSize = number;

/**
 * Chiều rộng button
 */
export type ButtonWidth = 'fit' | 'full';

/**
 * Vị trí căn chỉnh nội dung
 */
export type ButtonAlign = 'left' | 'center' | 'right';

/**
 * Vị trí icon
 */
export type ButtonIconPosition = 'left' | 'right';

/**
 * Icon type - có thể là LucideIcon, emoji, SVG, hoặc text
 */
export type ButtonIcon = LucideIcon | ReactNode;

/**
 * Props chính của Button component
 */
export interface ButtonProps {
  /** Kích thước button (percentage scale) */
  size?: ButtonSize;

  /** Chiều rộng button */
  width?: ButtonWidth;

  /** Nội dung button */
  children?: ReactNode;

  /** Trạng thái loading */
  loading?: boolean;

  /** Trạng thái disabled */
  disabled?: boolean;

  /** Icon (LucideIcon, emoji, SVG, text) */
  icon?: ButtonIcon;

  /** Căn chỉnh nội dung */
  align?: ButtonAlign;

  /** Custom class name */
  className?: string;

  /** Click handler */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;

  /** Text hiển thị khi loading (optional) */
  loadingText?: string;

  /** Vị trí icon (chỉ áp dụng khi có icon và có text) */
  iconPosition?: ButtonIconPosition;

  /** Các props HTML button khác */
  [key: string]: any;
}

/**
 * Interface cho button size configuration
 */
export interface ButtonSizeConfig {
  /** Chiều cao button */
  height: string;

  /** Padding horizontal */
  paddingX: string;

  /** Padding vertical */
  paddingY: string;

  /** Font size */
  fontSize: string;

  /** Border radius */
  borderRadius: string;

  /** Gap giữa icon và text */
  gap: string;
}

/**
 * Interface cho button style state
 */
export interface ButtonStyleState {
  /** Base styles */
  base: React.CSSProperties;

  /** Hover styles */
  hover?: React.CSSProperties;

  /** Focus styles */
  focus?: React.CSSProperties;

  /** Active styles */
  active?: React.CSSProperties;

  /** Disabled styles */
  disabled?: React.CSSProperties;
}
