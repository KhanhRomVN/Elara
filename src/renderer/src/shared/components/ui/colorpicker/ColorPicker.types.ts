export interface ColorPickerProps {
  /**
   * Currently selected color value
   */
  value?: string;

  /**
   * Callback when color is selected
   */
  onChange?: (color: string) => void;

  /**
   * Array of available colors to choose from
   * @default predefined color palette
   */
  colors?: string[];

  /**
   * Size of each color box in pixels
   * @default 40
   */
  colorSize?: number;

  /**
   * Gap between color boxes in pixels
   * @default 8
   */
  gap?: number;

  /**
   * Number of columns in the grid
   * @default 8
   */
  columns?: number;

  /**
   * Show color value label
   * @default false
   */
  showLabel?: boolean;

  /**
   * Disabled state
   * @default false
   */
  disabled?: boolean;

  /**
   * Custom CSS class
   */
  className?: string;

  /**
   * Show checkmark on selected color
   * @default true
   */
  showCheckmark?: boolean;
}
