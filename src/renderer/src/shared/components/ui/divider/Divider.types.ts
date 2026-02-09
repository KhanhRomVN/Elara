export type DividerOrientation = 'horizontal' | 'vertical';
export type DividerStyle = 'solid' | 'dashed' | 'dotted';
export type DividerAlign = 'start' | 'center' | 'end';
export type DividerThickness = 'thin' | 'medium' | 'thick';

export interface DividerProps {
  /** Hướng của divider */
  orientation?: DividerOrientation;

  /** Kiểu hiển thị: solid, dashed, dotted */
  style?: DividerStyle;

  /** Độ dày của divider */
  thickness?: DividerThickness | number;

  /** Căn chỉnh divider: start, center, end */
  align?: DividerAlign;

  /** Độ dài của divider theo % so với container cha (0-100) */
  length?: number;

  /** Class tùy chỉnh cho màu sắc và styling khác */
  color?: string;

  /** Class tùy chỉnh cho màu sắc và styling khác */
  className?: string;

  /** Props khác */
  [key: string]: any;
}
