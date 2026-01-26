import { createContext } from 'react';
import { DropdownContextValue } from './Dropdown.types';

export const DropdownContext = createContext<DropdownContextValue | null>(null);
