import { ReactNode } from 'react';

export type AccordionType = 'single' | 'multiple';

export interface AccordionContextValue {
  type: AccordionType;
  collapsible: boolean;
  openItems: Set<string>;
  toggleItem: (value: string) => void;
  isOpen: (value: string) => boolean;
  currentValue?: string | null;
  dividerColor?: string;
}

export interface AccordionProps {
  /** Children components */
  children: ReactNode;

  /** Type of accordion */
  type?: AccordionType;

  /** Whether accordion is collapsible */
  collapsible?: boolean;

  /** Custom className */
  className?: string;

  /** Additional props */
  [key: string]: any;
}

export interface AccordionListProps {
  /** Children components */
  children: ReactNode;

  /** Custom className for divider border color */
  dividerColor?: string;

  /** Custom className */
  className?: string;

  /** Additional props */
  [key: string]: any;
}

export interface AccordionItemProps {
  /** Children components */
  children: ReactNode;

  /** Unique value for the item */
  value: string;

  /** Custom className */
  className?: string;

  /** Additional props */
  [key: string]: any;
}

export interface AccordionTriggerProps {
  /** Trigger content - can be ReactNode or render function */
  children: ReactNode | ((props: { isOpen: boolean }) => ReactNode);

  /** Additional props */
  [key: string]: any;
}

export interface AccordionContentProps {
  /** Content */
  children: ReactNode;

  /** Additional props */
  [key: string]: any;
}
