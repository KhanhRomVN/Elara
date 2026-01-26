import { ReactNode } from 'react';

export type DropdownPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'left-top'
  | 'left-center'
  | 'left-bottom'
  | 'right-top'
  | 'right-center'
  | 'right-bottom';

export type DropdownSize = 'sm' | 'md' | 'lg';

export interface DropdownContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  position: DropdownPosition;
  size: DropdownSize;
  closeOnSelect: boolean;
  disabled: boolean;
}

export interface DropdownProps {
  /** Children components (DropdownTrigger, DropdownContent) */
  children: ReactNode;

  /** Position of dropdown content relative to trigger */
  position?: DropdownPosition;

  /** Size variant */
  size?: DropdownSize;

  /** Close dropdown when item is selected */
  closeOnSelect?: boolean;

  /** Disabled state */
  disabled?: boolean;

  /** Controlled open state */
  open?: boolean;

  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;

  /** Default open state (uncontrolled) */
  defaultOpen?: boolean;

  /** Custom className */
  className?: string;
}

export interface DropdownTriggerProps {
  /** Trigger content */
  children: ReactNode;

  /** Custom className */
  className?: string;

  /** Additional props */
  [key: string]: any;
}

export interface DropdownContentProps {
  /** Content */
  children: ReactNode;

  /** Custom className */
  className?: string;

  /** Max height */
  maxHeight?: string;

  /** Min width */
  minWidth?: string;

  /** Additional props */
  [key: string]: any;
}

export interface DropdownItemProps {
  /** Item content */
  children?: ReactNode;

  /** Disabled state */
  disabled?: boolean;

  /** Click handler */
  onClick?: () => void;

  /** Custom className */
  className?: string;

  /** Icon on the left */
  leftIcon?: ReactNode;

  /** Icon on the right */
  rightIcon?: ReactNode;

  /** Additional props */
  [key: string]: any;
}
