import React from 'react';
import { InputOTPProps } from './InputOTP.types';
import {
  getInputOTPSizeStyles,
  getInputOTPVariantStyles,
  validateInputOTPProps,
} from './InputOTP.utils';
import { cn } from '../../../../shared/utils/cn';

const InputOTP: React.FC<InputOTPProps> = ({
  length = 6,
  size = 100,
  variant = 'outline',
  type = 'text',
  disabled = false,
  loading = false,
  autoFocus = true,
  className = '',
  onChange,
  onComplete,
  ...props
}) => {
  const [values, setValues] = React.useState<string[]>(Array(length).fill(''));
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  const isDisabled = disabled || loading;
  const sizeStyles = getInputOTPSizeStyles(size);
  const variantStyles = getInputOTPVariantStyles(variant, isDisabled);

  React.useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0]?.focus();
    }
  }, [autoFocus]);

  const handleChange = (index: number, value: string) => {
    if (isDisabled) return;

    // Only allow single character per input
    const newValue = value.slice(-1);

    const newValues = [...values];
    newValues[index] = newValue;
    setValues(newValues);

    // Call onChange with the complete value
    const completeValue = newValues.join('');
    if (onChange) {
      onChange(completeValue);
    }

    // Move to next input if value is entered
    if (newValue && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Call onComplete if all inputs are filled
    if (completeValue.length === length && onComplete) {
      onComplete(completeValue);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!values[index] && index > 0) {
        // Move to previous input on backspace if current is empty
        inputRefs.current[index - 1]?.focus();
      }

      const newValues = [...values];
      newValues[index] = '';
      setValues(newValues);

      const completeValue = newValues.join('');
      if (onChange) {
        onChange(completeValue);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').slice(0, length);

    const newValues = [...values];
    pasteData.split('').forEach((char, index) => {
      if (index < length) {
        newValues[index] = char;
      }
    });

    setValues(newValues);

    const completeValue = newValues.join('');
    if (onChange) {
      onChange(completeValue);
    }

    if (completeValue.length === length && onComplete) {
      onComplete(completeValue);
    }

    // Focus the next empty input or the last one
    const nextEmptyIndex = newValues.findIndex((val) => !val);
    const focusIndex = nextEmptyIndex === -1 ? length - 1 : Math.min(nextEmptyIndex, length - 1);
    inputRefs.current[focusIndex]?.focus();
  };

  return (
    <div className={cn('input-otp-container flex gap-2 items-center justify-center', className)}>
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(el) => (inputRefs.current[index] = el)}
          type={type}
          value={values[index]}
          maxLength={1}
          disabled={isDisabled}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          className="text-center outline-none font-inherit font-bold transition-all duration-200"
          style={{
            ...sizeStyles,
            ...variantStyles,
            width: sizeStyles.height,
            opacity: isDisabled ? 0.6 : 1,
            cursor: isDisabled ? 'not-allowed' : 'text',
          }}
          {...props}
        />
      ))}
    </div>
  );
};

export default InputOTP;
