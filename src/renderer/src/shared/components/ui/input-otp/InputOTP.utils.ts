import { CSSProperties } from 'react';
import { InputOTPSize, InputOTPVariant } from './InputOTP.types';

/**
 * Get input OTP size styles based on size percentage
 */
export const getInputOTPSizeStyles = (size: InputOTPSize): CSSProperties => {
  const scale = size / 100;

  // Base dimensions at 100% scale
  const baseHeight = 48;
  const baseFontSize = 16;
  const baseBorderRadius = 8;

  // Calculate scaled values
  const height = baseHeight * scale;
  const fontSize = baseFontSize * scale;
  const borderRadius = baseBorderRadius * scale;

  return {
    height: `${height}px`,
    fontSize: `${fontSize}px`,
    borderRadius: `${borderRadius}px`,
  };
};

/**
 * Get input OTP variant styles
 */
export const getInputOTPVariantStyles = (
  variant: InputOTPVariant,
  isDisabled: boolean,
): CSSProperties => {
  const baseStyles = {
    border: '2px solid',
    backgroundColor: 'var(--input-background, #ffffff)',
    color: 'var(--text-primary, #000000)',
  };

  switch (variant) {
    case 'filled':
      return {
        ...baseStyles,
        borderColor: 'var(--border-default, #e5e7eb)',
        backgroundColor: isDisabled
          ? 'var(--input-background-disabled, #f9fafb)'
          : 'var(--input-background, #f8fafc)',
      };
    case 'underline':
      return {
        ...baseStyles,
        border: 'none',
        borderBottom: '2px solid var(--border-default, #e5e7eb)',
        borderRadius: '0px',
        backgroundColor: 'transparent',
      };
    case 'outline':
    default:
      return {
        ...baseStyles,
        borderColor: 'var(--border-default, #e5e7eb)',
        backgroundColor: isDisabled
          ? 'var(--input-background-disabled, #f9fafb)'
          : 'var(--input-background, #ffffff)',
      };
  }
};

/**
 * Validate input OTP props
 */
export const validateInputOTPProps = (props: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (props.size && (props.size < 50 || props.size > 200)) {
    errors.push('Size should be between 50% and 200%');
  }

  if (props.length && (props.length < 1 || props.length > 10)) {
    errors.push('Length should be between 1 and 10');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
