import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '../../lib/utils';

interface DualRangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
  className?: string;
  formatLabel?: (value: number) => string;
}

export const DualRangeSlider = ({
  min,
  max,
  step = 1,
  value,
  onValueChange,
  className,
}: DualRangeSliderProps) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<'min' | 'max' | null>(null);

  // Helper: Percentage for positioning
  const getPercentage = useCallback(
    (val: number) => {
      return ((val - min) / (max - min)) * 100;
    },
    [min, max],
  );

  // Helper: Calculate value from mouse X position
  const getValueFromX = useCallback(
    (clientX: number) => {
      if (!sliderRef.current) return min;
      const rect = sliderRef.current.getBoundingClientRect();
      const width = rect.width;
      const x = clientX - rect.left;

      let val = (x / width) * (max - min) + min;
      // Snap to step
      val = Math.round(val / step) * step;
      return Math.max(min, Math.min(max, val));
    },
    [max, min, step],
  );

  const handleMouseDown = (e: React.MouseEvent, thumb: 'min' | 'max') => {
    e.preventDefault();
    setIsDragging(thumb);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const newValue = getValueFromX(e.clientX);

      if (isDragging === 'min') {
        const clamped = Math.min(newValue, value[1] - step);
        if (clamped >= min && clamped !== value[0]) {
          onValueChange([clamped, value[1]]);
        }
      } else {
        const clamped = Math.max(newValue, value[0] + step);
        if (clamped <= max && clamped !== value[1]) {
          onValueChange([value[0], clamped]);
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(null);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, getValueFromX, value, min, max, step, onValueChange]);

  // Interaction on track to jump to position?
  // Maybe later. For now just standard thumb dragging.

  return (
    <div className={cn('relative w-full h-5 flex items-center select-none touch-none', className)}>
      {/* Track Background */}
      <div ref={sliderRef} className="relative w-full h-1.5 bg-secondary/50 rounded-full">
        {/* Active Range Bar */}
        <div
          className="absolute h-full bg-primary rounded-full"
          style={{
            left: `${getPercentage(value[0])}%`,
            width: `${getPercentage(value[1]) - getPercentage(value[0])}%`,
          }}
        />
      </div>

      {/* Thumb Min */}
      <div
        className={cn(
          'absolute w-4 h-4 bg-background border-2 border-primary rounded-full shadow-sm cursor-grab transition-transform z-10 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          isDragging === 'min' && 'cursor-grabbing scale-110 ring-2 ring-ring ring-offset-2',
        )}
        style={{ left: `calc(${getPercentage(value[0])}% - 8px)` }}
        onMouseDown={(e) => handleMouseDown(e, 'min')}
        role="slider"
        aria-valuenow={value[0]}
        aria-valuemin={min}
        aria-valuemax={value[1]}
      />

      {/* Thumb Max */}
      <div
        className={cn(
          'absolute w-4 h-4 bg-background border-2 border-primary rounded-full shadow-sm cursor-grab transition-transform z-10 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          isDragging === 'max' && 'cursor-grabbing scale-110 ring-2 ring-ring ring-offset-2',
        )}
        style={{ left: `calc(${getPercentage(value[1])}% - 8px)` }}
        onMouseDown={(e) => handleMouseDown(e, 'max')}
        role="slider"
        aria-valuenow={value[1]}
        aria-valuemin={value[0]}
        aria-valuemax={max}
      />
    </div>
  );
};
