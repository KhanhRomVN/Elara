import { ReactNode } from 'react';

/**
 * DateTime picker modes
 */
export type DateTimePickerMode = 'date' | 'time' | 'datetime';

/**
 * DateTime picker sizes
 */
export type DateTimePickerSize = 'sm' | 'md' | 'lg';

/**
 * DateTime picker variants
 */
export type DateTimePickerVariant = 'outline' | 'filled' | 'underline';

/**
 * Date format options
 */
export interface DateFormat {
  display: string;
  value: string;
}

/**
 * Time format options
 */
export interface TimeFormat {
  display: string;
  value: string;
}

/**
 * Main DateTimePicker props
 */
export interface DateTimePickerProps {
  /** Selected date/time value */
  value?: Date | null;
  /** Default value */
  defaultValue?: Date | null;
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Error state */
  error?: boolean;
  /** Error message */
  errorMessage?: string;
  /** Success state */
  success?: boolean;
  /** Size variant */
  size?: DateTimePickerSize;
  /** Style variant */
  variant?: DateTimePickerVariant;
  /** Picker mode */
  mode?: DateTimePickerMode;
  /** Date format */
  dateFormat?: string;
  /** Time format */
  timeFormat?: string;
  /** Minimum selectable date */
  minDate?: Date;
  /** Maximum selectable date */
  maxDate?: Date;
  /** Custom class name */
  className?: string;
  /** Change handler */
  onChange?: (date: Date | null) => void;
  /** Whether to show time picker in datetime mode */
  showTimePicker?: boolean;
  /** Whether to show clear button */
  clearable?: boolean;
  /** Custom icon */
  icon?: ReactNode;
  /** Position of calendar popup */
  placement?: 'top' | 'bottom';
  /** Additional props */
  [key: string]: any;
}

/**
 * Time slot for time picker
 */
export interface TimeSlot {
  hour: number;
  minute: number;
  label: string;
  disabled?: boolean;
}

/**
 * Calendar day interface
 */
export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isDisabled: boolean;
}
