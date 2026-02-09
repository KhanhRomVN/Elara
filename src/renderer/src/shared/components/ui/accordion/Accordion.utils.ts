/**
 * Utility functions for Accordion component
 */

import React from 'react';

/**
 * Check if value is valid for accordion item
 */
export const isValidValue = (value: any): boolean => {
  return typeof value === 'string' && value.trim().length > 0;
};

/**
 * Get item value from children
 */
export const getItemValue = (children: React.ReactNode): string | null => {
  const childrenArray = React.Children.toArray(children);

  for (const child of childrenArray) {
    if (React.isValidElement(child)) {
      if (child.type === AccordionItem) {
        return child.props.value || null;
      }

      // Check recursively
      const nestedValue = getItemValue(child.props.children);
      if (nestedValue) return nestedValue;
    }
  }

  return null;
};

/**
 * Helper function to check if component is AccordionItem
 * Note: This would need to be imported or defined differently in practice
 */
const AccordionItem = ({ children }: { children: React.ReactNode }) => children;
