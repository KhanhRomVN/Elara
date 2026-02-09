import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

/**
 * Kích thước breadcrumb (percentage scale)
 */
export type BreadcrumbSize = number;

/**
 * Props chính của Breadcrumb component
 */
export interface BreadcrumbProps {
  /** Children (BreadcrumbItem components) */
  children: ReactNode;

  /** Icon ngăn cách giữa các item - chỉ LucideIcon */
  separator?: LucideIcon;

  /** Kích thước breadcrumb */
  size?: BreadcrumbSize;

  /** Custom class name */
  className?: string;

  /** Các props HTML nav khác */
  [key: string]: any;
}

/**
 * Props của BreadcrumbItem component
 */
export interface BreadcrumbItemProps {
  /** Icon của item - chỉ LucideIcon */
  icon?: LucideIcon;

  /** Text hiển thị */
  text: string;

  /** URL (optional) */
  href?: string;

  /** Click handler (optional) */
  onClick?: () => void;

  /** Custom class name */
  className?: string;

  /** Các props HTML khác */
  [key: string]: any;
}
