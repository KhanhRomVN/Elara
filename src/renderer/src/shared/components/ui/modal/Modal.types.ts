import { ReactNode, CSSProperties } from 'react';

/**
 * Kích thước modal
 */
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

/**
 * Vị trí modal
 */
export type ModalPosition = 'center' | 'top' | 'bottom';

/**
 * Animation type
 */
export type ModalAnimation = 'fade' | 'slide' | 'scale' | 'none';

/**
 * Props chính của Modal component
 */
export interface ModalProps {
  /** Hiển thị modal */
  open: boolean;

  /** Callback khi đóng modal */
  onClose: () => void;

  /** Tiêu đề modal */
  title?: ReactNode;

  /** Nội dung modal */
  children: ReactNode;

  /** Footer content (buttons, etc.) */
  footer?: ReactNode;

  /** Kích thước modal */
  size?: ModalSize;

  /** Vị trí modal */
  position?: ModalPosition;

  /** Custom class name */
  className?: string;

  /** Custom overlay class */
  overlayClassName?: string;

  /** Custom content class */
  contentClassName?: string;

  /** Có đóng modal khi click overlay không */
  closeOnOverlayClick?: boolean;

  /** Có hiện nút close không */
  showCloseButton?: boolean;

  /** Có thể đóng modal bằng ESC không */
  closeOnEsc?: boolean;

  /** Animation type */
  animation?: ModalAnimation;

  /** Custom styles */
  style?: CSSProperties;

  /** Custom overlay styles */
  overlayStyle?: CSSProperties;

  /** Custom content styles */
  contentStyle?: CSSProperties;
}

/**
 * Modal context type
 */
export interface ModalContextType {
  onClose: () => void;
}
