import { createContext } from 'react';
import { AccordionContextValue } from './Accordion.types';

export const AccordionContext = createContext<AccordionContextValue | null>(null);

export const AccordionListContext = createContext<{
  dividerColor?: string;
} | null>(null);
