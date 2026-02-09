import { ReactNode } from 'react';

export interface ComboboxOption {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
}

export type ComboboxSize = 'sm' | 'md' | 'lg';

export interface ComboboxItemProps {
  value: string;
  label?: string;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export interface ComboboxProps {
  options?: ComboboxOption[];
  value?: string;
  searchQuery?: string;
  size?: ComboboxSize;
  className?: string;
  onChange?: (value: string, option: ComboboxOption) => void;
  onSearch?: (query: string) => void;
  emptyMessage?: string;
  searchable?: boolean;
  creatable?: boolean;
  creatableMessage?: string;
  creatableClassName?: string;
  creatableIcon?: ReactNode;
  onCreate?: (value: string) => void;
  renderOption?: (option: ComboboxOption) => ReactNode;
  maxHeight?: string;
  children?: ReactNode;
}
