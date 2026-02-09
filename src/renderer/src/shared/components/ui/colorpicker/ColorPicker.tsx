import React from 'react';
import { ColorPickerProps } from './ColorPicker.types';
import { DEFAULT_COLORS, getGridStyle, getColorBoxStyle, isLightColor } from './ColorPicker.utils';
import { Check } from 'lucide-react';
import { cn } from '../../../../shared/utils/cn';

const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  onChange,
  colors = DEFAULT_COLORS,
  colorSize = 40,
  gap = 8,
  columns = 8,
  showLabel = false,
  disabled = false,
  className = '',
  showCheckmark = true,
}) => {
  const handleColorClick = (color: string) => {
    if (!disabled && onChange) {
      onChange(color);
    }
  };

  return (
    <div className={`colorpicker-container ${className}`.trim()}>
      {/* Color Grid */}
      <div
        className="colorpicker-grid"
        style={{
          ...getGridStyle(columns),
          gap: `${gap}px`,
        }}
      >
        {colors.map((color, index) => {
          const isSelected = value === color;
          const isLight = isLightColor(color);

          return (
            <div
              key={`${color}-${index}`}
              className="colorpicker-item"
              style={getColorBoxStyle(color, colorSize, isSelected, disabled)}
              onClick={() => handleColorClick(color)}
              title={color}
              role="button"
              tabIndex={disabled ? -1 : 0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleColorClick(color);
                }
              }}
            >
              {/* Checkmark for selected color */}
              {isSelected && showCheckmark && (
                <Check
                  size={colorSize * 0.5}
                  color={isLight ? '#000000' : '#ffffff'}
                  strokeWidth={3}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Color Label */}
      {showLabel && value && (
        <div
          className="colorpicker-label text-sm font-mono text-center"
          style={{
            marginTop: `${gap * 2}px`,
          }}
        >
          Selected: <span>{value}</span>
        </div>
      )}
    </div>
  );
};

export default ColorPicker;
