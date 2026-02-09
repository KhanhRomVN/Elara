import { createContext, useContext } from 'react';
import { CodeBlockContextValue } from './CodeBlock.types';

export const CodeBlockContext = createContext<CodeBlockContextValue | undefined>(undefined);

export const useCodeBlock = () => {
  const context = useContext(CodeBlockContext);
  if (!context) {
    throw new Error('useCodeBlock must be used within a CodeBlockProvider');
  }
  return context;
};
