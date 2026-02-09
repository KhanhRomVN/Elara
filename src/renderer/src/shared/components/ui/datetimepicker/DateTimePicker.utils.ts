import {
  DateTimePickerSize,
  DateTimePickerVariant,
  TimeSlot,
  CalendarDay,
} from './DateTimePicker.types';

/**
 * Get date time picker size styles
 */
export const getDateTimePickerSizeStyles = (size: DateTimePickerSize) => {
  const sizes = {
    sm: {
      className: 'h-8 text-xs px-2 py-1',
      iconSize: 14,
    },
    md: {
      className: 'h-10 text-sm px-3 py-2',
      iconSize: 16,
    },
    lg: {
      className: 'h-12 text-base px-4 py-2.5',
      iconSize: 18,
    },
  };

  return sizes[size];
};

/**
 * Format date to string based on format
 */
export const formatDate = (date: Date | null, format: string = 'MM/dd/yyyy'): string => {
  if (!date) return '';

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');

  return format
    .replace('dd', day)
    .replace('MM', month)
    .replace('yyyy', year.toString())
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
};

/**
 * Generate calendar days for a specific month
 */
export const generateCalendarDays = (
  year: number,
  month: number,
  selectedDate?: Date,
  minDate?: Date,
  maxDate?: Date,
): CalendarDay[] => {
  const days: CalendarDay[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Days from previous month
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  const firstDayOfWeek = firstDay.getDay();

  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, prevMonthLastDay - i);
    days.push({
      date,
      isCurrentMonth: false,
      isToday: isToday(date),
      isSelected: selectedDate ? isSameDay(date, selectedDate) : false,
      isDisabled: isDateDisabled(date, minDate, maxDate),
    });
  }

  // Current month days
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const date = new Date(year, month, i);
    days.push({
      date,
      isCurrentMonth: true,
      isToday: isToday(date),
      isSelected: selectedDate ? isSameDay(date, selectedDate) : false,
      isDisabled: isDateDisabled(date, minDate, maxDate),
    });
  }

  // Days from next month
  const totalCells = 42; // 6 weeks
  const nextMonthDays = totalCells - days.length;
  for (let i = 1; i <= nextMonthDays; i++) {
    const date = new Date(year, month + 1, i);
    days.push({
      date,
      isCurrentMonth: false,
      isToday: isToday(date),
      isSelected: selectedDate ? isSameDay(date, selectedDate) : false,
      isDisabled: isDateDisabled(date, minDate, maxDate),
    });
  }

  return days;
};

/**
 * Generate time slots for time picker
 */
export const generateTimeSlots = (
  interval: number = 30,
  minTime?: Date,
  maxTime?: Date,
): TimeSlot[] => {
  const slots: TimeSlot[] = [];

  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += interval) {
      const time = new Date();
      time.setHours(hour, minute, 0, 0);

      const label = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const disabled = isTimeDisabled(time, minTime, maxTime);

      slots.push({ hour, minute, label, disabled });
    }
  }

  return slots;
};

/**
 * Check if date is today
 */
export const isToday = (date: Date): boolean => {
  const today = new Date();
  return isSameDay(date, today);
};

/**
 * Check if two dates are the same day
 */
export const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
};

/**
 * Check if date is disabled
 */
export const isDateDisabled = (date: Date, minDate?: Date, maxDate?: Date): boolean => {
  if (minDate && date < minDate) return true;
  if (maxDate && date > maxDate) return true;
  return false;
};

/**
 * Check if time is disabled
 */
export const isTimeDisabled = (time: Date, minTime?: Date, maxTime?: Date): boolean => {
  if (minTime && time < minTime) return true;
  if (maxTime && time > maxTime) return true;
  return false;
};

/**
 * Validate date time picker props
 */
export const validateDateTimePickerProps = (props: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (props.minDate && props.maxDate && props.minDate > props.maxDate) {
    errors.push('minDate cannot be greater than maxDate');
  }

  if (props.value && !(props.value instanceof Date)) {
    errors.push('value must be a Date object');
  }

  if (props.defaultValue && !(props.defaultValue instanceof Date)) {
    errors.push('defaultValue must be a Date object');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
