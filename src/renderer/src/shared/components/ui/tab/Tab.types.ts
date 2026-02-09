import { ReactNode } from 'react';

export interface TabContextValue {
  activeTab: string;
  setActiveTab: (tabId: string) => void;
}

export interface TabProps {
  /** Children components (TabItem) */
  children: ReactNode;

  /** Default active tab ID */
  defaultActive?: string;

  /** Controlled active tab */
  active?: string;

  /** Callback when active tab changes */
  onActiveChange?: (tabId: string) => void;

  /** Width mode */
  width?: 'full' | 'fit';

  /** Alignment of tabs */
  align?: 'left' | 'center' | 'right' | 'space-between';

  /** Custom className */
  className?: string;
}

export interface TabItemProps {
  /** Tab ID (must be unique) */
  id: string;

  /** Tab content */
  children: ReactNode;

  /** Disabled state */
  disabled?: boolean;

  /** Custom className for default state */
  className?: string;

  /** Custom className for hover state */
  hoverClassName?: string;

  /** Custom className for active/focused state */
  activeClassName?: string;

  /** Icon (can be LucideIcon or ReactNode) */
  icon?: ReactNode;

  /** Icon position */
  iconPosition?: 'left' | 'right';

  /** Additional props */
  [key: string]: any;
}
