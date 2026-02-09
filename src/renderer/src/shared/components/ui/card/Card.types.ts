import { ReactNode } from 'react';

/**
 * Căn chỉnh card trong container cha
 */
export interface CardAlign {
  horizontal?: 'left' | 'center' | 'right';
  vertical?: 'top' | 'center' | 'bottom';
}

/**
 * Chiều rộng card (phân số từ 0-1 của container cha)
 * Ví dụ: 0.5 = 50%, 0.33 = 33%, 1 = 100%
 */
export type CardWidth = number;

/**
 * Props chính của Card component
 */
export interface CardProps {
  /** Chiều rộng card (phân số 0-1, ví dụ: 0.5 = 50%) */
  width?: CardWidth;

  /** Căn chỉnh card trong container cha */
  cardAlign?: CardAlign;

  /** Nội dung card */
  children?: ReactNode;

  /** Custom class name */
  className?: string;

  /** Click handler */
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;

  /** Các props HTML div khác */
  [key: string]: any;
}

/**
 * Props cho CardHeader component
 */
export interface CardHeaderProps {
  /** Nội dung header */
  children?: ReactNode;

  /** Custom class name */
  className?: string;

  /** Các props HTML div khác */
  [key: string]: any;
}

/**
 * Props cho CardBody component
 */
export interface CardBodyProps {
  /** Nội dung body */
  children?: ReactNode;

  /** Custom class name */
  className?: string;

  /** Các props HTML div khác */
  [key: string]: any;
}

/**
 * Props cho CardFooter component
 */
export interface CardFooterProps {
  /** Nội dung footer */
  children?: ReactNode;

  /** Custom class name */
  className?: string;

  /** Các props HTML div khác */
  [key: string]: any;
}
