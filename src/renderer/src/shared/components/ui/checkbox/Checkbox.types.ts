import { ReactNode } from 'react';

/**
 * Kích thước checkbox (percentage scale)
 */
export type CheckboxSize = number;

/**
 * Trạng thái checkbox
 */
export type CheckboxState = 'checked' | 'unchecked' | 'indeterminate';

/**
 * Vị trí label
 */
export type CheckboxLabelPosition = 'left' | 'right';

/**
 * Props chính của Checkbox component
 */
export interface CheckboxProps {
  /** Kích thước checkbox */
  size?: CheckboxSize;

  /** Trạng thái checked */
  checked?: boolean;

  /** Trạng thái indeterminate */
  indeterminate?: boolean;

  /** Label cho checkbox */
  label?: string | ReactNode;

  /** Vị trí label */
  labelPosition?: CheckboxLabelPosition;

  /** Trạng thái disabled */
  disabled?: boolean;

  /** Trạng thái loading */
  loading?: boolean;

  /** Custom class name */
  className?: string;

  /** Change handler */
  onChange?: (checked: boolean) => void;

  /** Các props HTML input khác */
  [key: string]: any;
}

/**
 * Interface cho checkbox size configuration
 */
export interface CheckboxSizeConfig {
  /** Kích thước checkbox */
  size: string;

  /** Border radius */
  borderRadius: string;

  /** Font size label */
  labelFontSize: string;

  /** Gap giữa checkbox và label */
  gap: string;
}
