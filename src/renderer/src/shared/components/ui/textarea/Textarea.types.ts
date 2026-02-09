import { TextareaHTMLAttributes, ReactNode } from 'react';

export interface TextareaProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'onChange'
> {
  /**
   * Current value of the textarea
   */
  value?: string;

  /**
   * Callback when value changes
   */
  onChange?: (value: string) => void;

  /**
   * Label for the textarea
   */
  label?: string;

  /**
   * Placeholder text
   */
  placeholder?: string;

  /**
   * Error message to display
   */
  error?: string;

  /**
   * Helper text to display below textarea
   */
  helperText?: string;

  /**
   * Maximum character length
   */
  maxLength?: number;

  /**
   * Show character count
   * @default false
   */
  showCount?: boolean;

  /**
   * Auto resize based on content
   * @default false
   */
  autoResize?: boolean;

  /**
   * Minimum number of rows
   * @default 1
   * Can be "auto" to calculate based on parent height
   */
  minRows?: number | 'auto';

  /**
   * Maximum number of rows
   * If not provided, textarea won't auto-expand
   */
  maxRows?: number;

  /**
   * Number of rows
   * @default 4
   */
  rows?: number;

  /**
   * Disabled state
   * @default false
   */
  disabled?: boolean;

  /**
   * Read-only state
   * @default false
   */
  readOnly?: boolean;

  /**
   * Required field
   * @default false
   */
  required?: boolean;

  /**
   * Custom CSS class
   */
  className?: string;

  /**
   * Resize behavior
   * @default "vertical"
   */
  resize?: 'none' | 'both' | 'horizontal' | 'vertical';

  /**
   * Custom bottom wrapper component
   */
  bottomWrapper?: ReactNode;

  /**
   * Height of bottom wrapper for proper spacing
   */
  bottomWrapperHeight?: string;
}
