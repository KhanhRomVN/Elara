import { createContext } from 'react';
import { TabContextValue } from './Tab.types';

export const TabContext = createContext<TabContextValue | null>(null);
