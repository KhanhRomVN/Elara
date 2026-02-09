import React, { useState, useRef, useEffect } from 'react';
import { Calendar, Clock, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../../../shared/utils/cn';

import { DateTimePickerProps } from './DateTimePicker.types';
import {
  getDateTimePickerSizeStyles,
  generateCalendarDays,
  generateTimeSlots,
} from './DateTimePicker.utils';

const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  defaultValue,
  placeholder = 'Select date and time',
  disabled = false,
  loading = false,
  error = false,
  errorMessage,
  success = false,
  size = 'md',
  variant = 'outline',
  mode = 'datetime',
  dateFormat = 'MM/dd/yyyy',
  timeFormat = 'HH:mm',
  minDate,
  maxDate,
  className = '',
  onChange,
  showTimePicker = true,
  clearable = true,
  icon,
  placement = 'bottom',
  ...props
}) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(value || defaultValue || null);
  const [tempDate, setTempDate] = useState<Date | null>(value || defaultValue || null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isOpen, setIsOpen] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);

  // Update selected date when value prop changes
  useEffect(() => {
    if (value !== undefined) {
      setSelectedDate(value);
    }
  }, [value]);

  // Get display format based on mode
  const getDisplayFormat = (): string => {
    switch (mode) {
      case 'date':
        return dateFormat;
      case 'time':
        return timeFormat;
      case 'datetime':
        return `${dateFormat} ${timeFormat}`;
      default:
        return dateFormat;
    }
  };

  // Handle date selection
  const handleDateSelect = (date: Date) => {
    const newDate = new Date(date);
    if (tempDate && mode === 'datetime') {
      // Preserve time from previous selection
      newDate.setHours(tempDate.getHours());
      newDate.setMinutes(tempDate.getMinutes());
    }
    setTempDate(newDate);
  };

  // Handle time selection
  const handleTimeSelect = (hour: number, minute: number) => {
    const baseDate = tempDate || new Date();
    const newDate = new Date(baseDate);
    newDate.setHours(hour, minute, 0, 0);
    setTempDate(newDate);
  };

  // Handle scroll to select time
  const handleScrollToSelect = (event: React.UIEvent<HTMLDivElement>, type: 'hour' | 'minute') => {
    const container = event.currentTarget;
    const scrollTop = container.scrollTop;
    const itemHeight = 32;

    const selectedIndex = Math.round(scrollTop / itemHeight);

    if (type === 'hour') {
      const hour = Math.min(23, Math.max(0, selectedIndex));
      handleTimeSelect(hour, tempDate?.getMinutes() || 0);
    } else {
      const minute = Math.min(59, Math.max(0, selectedIndex));
      handleTimeSelect(tempDate?.getHours() || 0, minute);
    }
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  // Navigate to next month
  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Handle confirm selection
  const handleConfirm = () => {
    setSelectedDate(tempDate);
    if (onChange && tempDate) {
      onChange(tempDate);
    }
    setIsOpen(false);
  };

  // Handle cancel
  const handleCancel = () => {
    setTempDate(selectedDate);
    setIsOpen(false);
  };

  const sizeStyles = getDateTimePickerSizeStyles(size);
  const calendarDays = generateCalendarDays(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    tempDate ?? undefined,
    minDate,
    maxDate,
  );
  const timeSlots = generateTimeSlots(30, minDate, maxDate);

  const defaultIcon =
    mode === 'time' ? (
      <Clock size={sizeStyles.iconSize} />
    ) : (
      <Calendar size={sizeStyles.iconSize} />
    );

  return (
    <div ref={containerRef} className={cn('w-full bg-gray-900/50', className)}>
      {mode === 'datetime' && showTimePicker ? (
        <div className="flex w-full">
          {/* Calendar Section */}
          <div className="p-4 border-r border-border-default flex-1 bg-gray-800/30">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="p-1 rounded">
                <ChevronLeft size={16} />
              </button>
              <div className="font-semibold">
                {currentMonth.toLocaleString('default', { month: 'long' })}{' '}
                {currentMonth.getFullYear()}
              </div>
              <button onClick={nextMonth} className="p-1 rounded">
                <ChevronRight size={16} />
              </button>
            </div>
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                <div key={day} className="text-center text-xs  font-medium py-1">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => (
                <button
                  key={index}
                  onClick={() => !day.isDisabled && handleDateSelect(day.date)}
                  disabled={day.isDisabled}
                  className={`
                    h-8 rounded text-sm transition-colors
                    ${day.isToday ? 'border border-dashed ' : ''}
                    ${day.isSelected ? 'bg-blue-600 text-white' : ''}
                    ${
                      !day.isSelected && !day.isToday && day.isCurrentMonth
                        ? 'hover:bg-sidebar-item-hover'
                        : ''
                    }
                    ${day.isDisabled ? 'opacity-30 cursor-not-allowed' : ''}
                  `}
                >
                  {day.date.getDate()}
                </button>
              ))}
            </div>
          </div>
          {/* Time Section - Dual Scroll */}
          <div className="p-4 flex-shrink-0 relative flex flex-col">
            <div className="font-semibold mb-3 text-center">Select Time</div>
            <div className="flex gap-2 items-start relative flex-1">
              {/* Hour Selector */}
              <div className="flex flex-col items-center relative">
                <div className="text-xs  mb-2 font-medium">Hour</div>
                <div
                  className="h-[192px] w-16 overflow-y-auto border border-border-default rounded-md relative scroll-smooth"
                  onScroll={(e) => handleScrollToSelect(e, 'hour')}
                >
                  <div className="absolute top-[64px] left-0 right-0 h-8 bg-gray-700/30 pointer-events-none z-0"></div>
                  <div className="py-16">
                    {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                      <div
                        key={hour}
                        className={`
                          w-full px-2 h-8 text-sm transition-colors relative z-10 flex items-center justify-center
                          ${
                            tempDate && tempDate.getHours() === hour ? 'bg-blue-600 text-white' : ''
                          }
                        `}
                      >
                        {hour.toString().padStart(2, '0')}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Separator ":" */}
              <div className="flex items-center" style={{ marginTop: '94px' }}>
                <span className="text-2xl font-bold ">:</span>
              </div>
              {/* Minute Selector */}
              <div className="flex flex-col items-center relative">
                <div className="text-xs  mb-2 font-medium">Minute</div>
                <div
                  className="h-[192px] w-16 overflow-y-auto border rounded-md relative scroll-smooth"
                  onScroll={(e) => handleScrollToSelect(e, 'minute')}
                >
                  <div className="absolute top-[64px] left-0 right-0 h-8 bg-gray-700/30 pointer-events-none z-0"></div>
                  <div className="py-16">
                    {Array.from({ length: 60 }, (_, i) => i).map((minute) => (
                      <div
                        key={minute}
                        className={`
                          w-full px-2 h-8 text-sm transition-colors relative z-10 flex items-center justify-center
                          ${
                            tempDate && tempDate.getMinutes() === minute
                              ? 'bg-blue-600 text-white'
                              : ''
                          }
                        `}
                      >
                        {minute.toString().padStart(2, '0')}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* Action Buttons */}
            <div className="flex gap-2 justify-end mt-4 pt-3 border-t border-border-default">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm rounded bg-gray-700 hover:bg-gray-600  transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                Select
              </button>
            </div>
          </div>
        </div>
      ) : mode === 'date' ? (
        <div className="p-4 bg-gray-800/30">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-1  rounded">
              <ChevronLeft size={16} />
            </button>
            <div className="font-semibold ">
              {currentMonth.toLocaleString('default', { month: 'long' })}{' '}
              {currentMonth.getFullYear()}
            </div>
            <button onClick={nextMonth} className="p-1 rounded">
              <ChevronRight size={16} />
            </button>
          </div>
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
              <div key={day} className="text-center text-xs  font-medium py-1">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => (
              <button
                key={index}
                onClick={() => !day.isDisabled && handleDateSelect(day.date)}
                disabled={day.isDisabled}
                className={`
                  h-8 rounded text-sm transition-colors
                  ${day.isCurrentMonth ? '' : ''}
                  ${day.isToday ? ' border border-dashed' : ''}
                  ${day.isSelected ? 'bg-blue-600 text-white' : ''}
                  ${
                    !day.isSelected && !day.isToday && day.isCurrentMonth
                      ? 'hover:bg-sidebar-item-hover'
                      : ''
                  }
                  ${day.isDisabled ? 'opacity-30 cursor-not-allowed' : ''}
                `}
              >
                {day.date.getDate()}
              </button>
            ))}
          </div>
          {/* Action Buttons */}
          <div className="flex gap-2 justify-end mt-4 pt-3 border-t border-border-default">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm rounded bg-gray-700 hover:bg-gray-600  transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              Select
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4">
          <div className="font-semibold  mb-3 text-center">Select Time</div>
          <div className="flex gap-2 justify-center items-start relative">
            {/* Hour Selector */}
            <div className="flex flex-col items-center relative">
              <div className="text-xs  mb-2 font-medium">Hour</div>
              <div
                className="h-[192px] w-16 overflow-y-auto border border-border-default rounded-md relative scroll-smooth"
                onScroll={(e) => handleScrollToSelect(e, 'hour')}
              >
                <div className="absolute top-[64px] left-0 right-0 h-8 bg-gray-700/30 pointer-events-none z-0"></div>
                <div className="py-16">
                  {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                    <div
                      key={hour}
                      className={`
                        w-full px-2 h-8 text-sm transition-colors relative z-10 flex items-center justify-center
                        ${
                          selectedDate && selectedDate.getHours() === hour
                            ? 'bg-blue-600 text-white'
                            : ''
                        }
                      `}
                    >
                      {hour.toString().padStart(2, '0')}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Separator ":" */}
            <div className="flex items-center pt-[30px]">
              <span className="text-2xl font-bold ">:</span>
            </div>
            {/* Minute Selector */}
            <div className="flex flex-col items-center relative">
              <div className="text-xs  mb-2 font-medium">Minute</div>
              <div
                className="h-[192px] w-16 overflow-y-auto border border-border-default rounded-md relative scroll-smooth"
                onScroll={(e) => handleScrollToSelect(e, 'minute')}
              >
                <div className="absolute top-[64px] left-0 right-0 h-8 bg-gray-700/30 pointer-events-none z-0"></div>
                <div className="py-16">
                  {Array.from({ length: 60 }, (_, i) => i).map((minute) => (
                    <div
                      key={minute}
                      className={`
                        w-full px-2 h-8 text-sm transition-colors relative z-10 flex items-center justify-center
                        ${
                          selectedDate && selectedDate.getMinutes() === minute
                            ? 'bg-blue-600 text-white'
                            : ''
                        }
                      `}
                    >
                      {minute.toString().padStart(2, '0')}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* Action Buttons */}
          <div className="flex gap-2 justify-end mt-4 pt-3 border-t border-border-default">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm rounded bg-gray-700 hover:bg-gray-600  transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              Select
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateTimePicker;
