import { DividerOrientation, DividerStyle, DividerAlign, DividerThickness } from './Divider.types';

/**
 * Lấy class cho kiểu hiển thị divider
 */
export const getDividerStyleClass = (style: DividerStyle = 'solid'): string => {
  const styleMap: Record<DividerStyle, string> = {
    solid: 'border-solid',
    dashed: 'border-dashed',
    dotted: 'border-dotted',
  };

  return styleMap[style];
};

/**
 * Lấy độ dày của divider dựa trên thickness prop
 */
export const getDividerThickness = (
  thickness: DividerThickness | number = 'medium',
  orientation: DividerOrientation = 'horizontal',
): string => {
  if (typeof thickness === 'number') {
    return orientation === 'horizontal' ? `border-t-[${thickness}px]` : `border-l-[${thickness}px]`;
  }

  const thicknessMap: Record<DividerThickness, string> = {
    thin: orientation === 'horizontal' ? 'border-t' : 'border-l',
    medium: orientation === 'horizontal' ? 'border-t-2' : 'border-l-2',
    thick: orientation === 'horizontal' ? 'border-t-4' : 'border-l-4',
  };

  return thicknessMap[thickness];
};

/**
 * Lấy class căn chỉnh divider
 */
export const getDividerAlignClass = (
  align: DividerAlign = 'center',
  orientation: DividerOrientation = 'horizontal',
): string => {
  if (orientation === 'horizontal') {
    const alignMap: Record<DividerAlign, string> = {
      start: 'mr-auto',
      center: 'mx-auto',
      end: 'ml-auto',
    };
    return alignMap[align];
  } else {
    const alignMap: Record<DividerAlign, string> = {
      start: 'mb-auto',
      center: 'my-auto',
      end: 'mt-auto',
    };
    return alignMap[align];
  }
};

/**
 * Lấy class cho độ dài divider
 */
export const getDividerLengthStyle = (
  length: number = 100,
  orientation: DividerOrientation = 'horizontal',
): React.CSSProperties => {
  const clampedLength = Math.min(Math.max(length, 0), 100);

  if (orientation === 'horizontal') {
    return { width: `${clampedLength}%` };
  } else {
    return { height: `${clampedLength}%` };
  }
};

/**
 * Lấy class cơ bản cho orientation
 */
export const getDividerOrientationClass = (
  orientation: DividerOrientation = 'horizontal',
): string => {
  return orientation === 'horizontal' ? 'w-full' : 'h-full';
};
