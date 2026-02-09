import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

export type BadgeColor = string;

export interface BadgeItem {
  id: string | number;
  label: string;
  color?: string;
}

export type InputSize = 'sm' | 'md' | 'lg' | 'xl';
export type InputType = 'text' | 'password' | 'combobox' | 'calendar';

export type InputIcon = LucideIcon | ReactNode;

export interface InputProps {
  /** interaction */
  /** state */
  /** status */
  /** content */
  /** validation */
  /** other */
  size?: InputSize;
  type?: InputType;
  placeholder?: string;
  value?: string;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: InputIcon;
  rightIcon?: InputIcon | InputIcon[];
  className?: string;
  popoverOpen?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  popoverContent?: ReactNode;
  onPopoverOpenChange?: (open: boolean) => void;
  inlinePanel?: ReactNode;
  // Multi-value props
  multiValue?: boolean;
  badges?: BadgeItem[];
  onBadgeRemove?: (id: string | number) => void;
  badgeColorMode?: 'uniform' | 'diverse';
  badgeColors?: string[];
  badgeVariant?: 'solid' | 'neon';
  [key: string]: any;
}
