import { CSSProperties } from 'react';
import { CardAlign } from './Card.types';

/**
 * Get card alignment styles (căn card trong container cha)
 */
export const getCardAlignmentStyles = (cardAlign?: CardAlign): CSSProperties => {
  const horizontal = cardAlign?.horizontal || 'left';
  const vertical = cardAlign?.vertical || 'top';

  const styles: CSSProperties = {};

  // Horizontal alignment
  switch (horizontal) {
    case 'left':
      styles.marginRight = 'auto';
      break;
    case 'center':
      styles.marginLeft = 'auto';
      styles.marginRight = 'auto';
      break;
    case 'right':
      styles.marginLeft = 'auto';
      break;
  }

  // Vertical alignment
  switch (vertical) {
    case 'top':
      styles.marginBottom = 'auto';
      break;
    case 'center':
      styles.marginTop = 'auto';
      styles.marginBottom = 'auto';
      break;
    case 'bottom':
      styles.marginTop = 'auto';
      break;
  }

  return styles;
};

/**
 * Validate card props
 */
export const validateCardProps = (props: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (props.width && (props.width < 0 || props.width > 1)) {
    errors.push('Width should be a fraction between 0 and 1 (e.g., 0.5 for 50%)');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
