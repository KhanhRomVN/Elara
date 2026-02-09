import { CSSProperties } from 'react';
import { CheckboxSize, CheckboxState, CheckboxLabelPosition } from './Checkbox.types';

/**
 * Get checkbox size styles based on size percentage
 */
export const getCheckboxSizeStyles = (
  size: CheckboxSize,
  hasLabel: boolean,
): {
  checkbox: CSSProperties;
  label: CSSProperties;
  container: CSSProperties;
} => {
  const scale = size / 100;

  // Base dimensions at 100% scale
  const baseSize = 16;
  const baseBorderRadius = 4;
  const baseLabelFontSize = 14;
  const baseGap = 8;

  // Calculate scaled values
  const checkboxSize = baseSize * scale;
  const borderRadius = baseBorderRadius * scale;
  const labelFontSize = baseLabelFontSize * scale;
  const gap = baseGap * scale;

  return {
    checkbox: {
      width: `${checkboxSize}px`,
      height: `${checkboxSize}px`,
      borderRadius: `${borderRadius}px`,
    },
    label: {
      fontSize: `${labelFontSize}px`,
    },
    container: {
      gap: `${gap}px`,
    },
  };
};

/**
 * Get checkbox state styles
 */
export const getCheckboxStateStyles = (state: CheckboxState, disabled: boolean): CSSProperties => {
  const baseStyles = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid',
    transition: 'all 0.2s ease-in-out',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  };

  switch (state) {
    case 'checked':
      return {
        ...baseStyles,
        backgroundColor: disabled ? 'var(--checkbox-bg-disabled)' : 'var(--checkbox-bg-checked)',
        borderColor: disabled
          ? 'var(--checkbox-border-disabled)'
          : 'var(--checkbox-border-checked)',
        color: 'var(--checkbox-checkmark)',
      };
    case 'unchecked':
      return {
        ...baseStyles,
        backgroundColor: 'var(--checkbox-bg)',
        borderColor: disabled ? 'var(--checkbox-border-disabled)' : 'var(--checkbox-border)',
      };
    case 'indeterminate':
      return {
        ...baseStyles,
        backgroundColor: disabled
          ? 'var(--checkbox-bg-disabled)'
          : 'var(--checkbox-bg-indeterminate)',
        borderColor: disabled
          ? 'var(--checkbox-border-disabled)'
          : 'var(--checkbox-border-indeterminate)',
        color: 'var(--checkbox-checkmark)',
      };
    default:
      return baseStyles;
  }
};

/**
 * Get label position styles
 */
export const getLabelPosition = (position: CheckboxLabelPosition): CSSProperties => {
  return {
    display: 'flex',
    alignItems: 'center',
    flexDirection: position === 'left' ? 'row-reverse' : 'row',
  };
};

/**
 * Get checkmark icon based on state
 */
export const getCheckmarkIcon = (state: CheckboxState): string => {
  switch (state) {
    case 'checked':
      return '✓';
    case 'indeterminate':
      return '—';
    default:
      return '';
  }
};

/**
 * Validate checkbox props
 */
export const validateCheckboxProps = (props: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (props.size && (props.size < 50 || props.size > 200)) {
    errors.push('Size should be between 50% and 200%');
  }

  if (props.indeterminate && props.checked) {
    errors.push('Checkbox cannot be both checked and indeterminate');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
