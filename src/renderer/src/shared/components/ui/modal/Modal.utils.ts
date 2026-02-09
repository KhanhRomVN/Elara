import { CSSProperties } from 'react';
import { ModalSize, ModalPosition, ModalAnimation } from './Modal.types';

/**
 * Get modal size styles
 */
export const getModalSizeStyles = (size: ModalSize): CSSProperties => {
  const sizes = {
    sm: { width: '400px', maxWidth: '90vw' },
    md: { width: '600px', maxWidth: '90vw' },
    lg: { width: '800px', maxWidth: '90vw' },
    xl: { width: '1000px', maxWidth: '90vw' },
    full: {
      width: '100%',
      height: '100%',
      maxWidth: '100vw',
      maxHeight: '100vh',
    },
  };

  return sizes[size];
};

/**
 * Get modal position styles
 */
export const getModalPositionStyles = (position: ModalPosition): CSSProperties => {
  const positions = {
    center: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    top: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingTop: '2rem',
    },
    bottom: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      paddingBottom: '2rem',
    },
  };

  return positions[position];
};

/**
 * Get modal animation classes
 */
export const getModalAnimationClasses = (animation: ModalAnimation, open: boolean): string => {
  if (animation === 'none') return '';

  const baseClass = 'modal-animation';
  const stateClass = open ? 'enter' : 'leave';

  const animations = {
    fade: `modal-fade-${stateClass}`,
    slide: `modal-slide-${stateClass}`,
    scale: `modal-scale-${stateClass}`,
  };

  return `${baseClass} ${animations[animation]}`;
};

/**
 * Validate modal props
 */
export const validateModalProps = (props: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (props.open === undefined) {
    errors.push("Modal must have an 'open' prop");
  }

  if (props.onClose === undefined) {
    errors.push("Modal must have an 'onClose' prop");
  }

  if (props.children === undefined) {
    errors.push('Modal must have children content');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Merge custom styles with base styles
 */
export const mergeModalStyles = (
  baseStyles: CSSProperties,
  customStyles?: CSSProperties,
): CSSProperties => {
  if (!customStyles) return baseStyles;

  return {
    ...baseStyles,
    ...customStyles,
  };
};
