import React from 'react';
import { CheckboxProps, CheckboxState } from './Checkbox.types';
import {
  getCheckboxSizeStyles,
  getCheckboxStateStyles,
  getLabelPosition,
  getCheckmarkIcon,
} from './Checkbox.utils';
import { cn } from '../../../../shared/utils/cn';

const Checkbox: React.FC<CheckboxProps> = ({
  size = 100,
  checked = false,
  indeterminate = false,
  label,
  labelPosition = 'right',
  disabled = false,
  loading = false,
  className = '',
  onChange,
  ...props
}) => {
  const hasLabel = !!label;

  // Xác định trạng thái
  const state: CheckboxState = indeterminate ? 'indeterminate' : checked ? 'checked' : 'unchecked';

  const isDisabled = disabled || loading;

  // Lấy styles
  const sizeStyles = getCheckboxSizeStyles(size, hasLabel);
  const stateStyles = getCheckboxStateStyles(state, isDisabled);
  const positionStyles = getLabelPosition(labelPosition);
  const checkmark = getCheckmarkIcon(state);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isDisabled && onChange) {
      onChange(e.target.checked);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement | HTMLLabelElement>) => {
    e.stopPropagation();
    if (!isDisabled && onChange) {
      onChange(!checked);
    }
  };

  return (
    <div
      className={cn('checkbox-container inline-flex items-center', className)}
      style={{
        ...sizeStyles.container,
        ...positionStyles,
      }}
    >
      {/* Hidden input for form submission */}
      <input
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        disabled={isDisabled}
        className="hidden"
        {...props}
      />

      {/* Custom checkbox */}
      <div
        className="checkbox-custom relative"
        style={{
          ...sizeStyles.checkbox,
          ...stateStyles,
        }}
        onClick={handleClick}
      >
        {checkmark && (
          <span
            className="leading-none font-bold select-none"
            style={{
              fontSize: `calc(${sizeStyles.checkbox.width} * 0.7)`,
            }}
          >
            {checkmark}
          </span>
        )}

        {/* Loading spinner */}
        {loading && (
          <div
            className="absolute top-1/2 left-1/2 border-2 border-transparent border-t-current rounded-full animate-spin -translate-x-1/2 -translate-y-1/2"
            style={{
              width: `calc(${sizeStyles.checkbox.width} * 0.6)`,
              height: `calc(${sizeStyles.checkbox.width} * 0.6)`,
            }}
          />
        )}
      </div>

      {/* Label */}
      {label && (
        <label
          className={cn(
            'checkbox-label select-none m-0',
            isDisabled ? 'cursor-not-allowed' : 'cursor-pointer',
          )}
          style={{
            ...sizeStyles.label,
          }}
          onClick={handleClick}
        >
          {label}
        </label>
      )}
    </div>
  );
};

export default Checkbox;
