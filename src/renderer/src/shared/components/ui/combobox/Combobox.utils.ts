import { ComboboxOption, ComboboxSize } from './Combobox.types';

/**
 * Get combobox size styles
 */
export const getComboboxSizeStyles = (size: ComboboxSize) => {
  const sizes = {
    sm: {
      fontSize: '14px',
      iconSize: 14,
    },
    md: {
      fontSize: '14px',
      iconSize: 16,
    },
    lg: {
      fontSize: '16px',
      iconSize: 18,
    },
  };

  return sizes[size];
};

/**
 * Filter options based on search query
 */
export const filterOptions = (
  options: ComboboxOption[],
  query: string,
  searchable?: boolean,
): ComboboxOption[] => {
  if (!searchable || !query) return options;

  return options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));
};

/**
 * Get option from value
 */
export const getOptionFromValue = (
  options: ComboboxOption[],
  value?: string,
): ComboboxOption | null => {
  if (!value) return null;
  return options.find((option) => option.value === value) || null;
};

/**
 * Generate unique ID for combobox elements
 */
export const generateId = (prefix: string): string => {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
};
