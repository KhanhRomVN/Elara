import React, { useState } from 'react';
import { AccordionProps, AccordionContextValue } from './Accordion.types';
import { cn } from '../../../../shared/utils/cn';

import { AccordionContext, AccordionListContext } from './AccordionContext';

const Accordion: React.FC<AccordionProps> = ({
  children,
  type = 'single',
  collapsible = true,
  className = '',
  ...props
}) => {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggleItem = (value: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);

      if (type === 'single') {
        if (prev.has(value) && collapsible) {
          next.clear();
        } else {
          next.clear();
          next.add(value);
        }
      } else {
        if (next.has(value)) {
          next.delete(value);
        } else {
          next.add(value);
        }
      }

      return next;
    });
  };

  const isOpen = (value: string) => openItems.has(value);

  const contextValue: AccordionContextValue = {
    type,
    collapsible,
    openItems,
    toggleItem,
    isOpen,
  };

  return (
    <AccordionContext.Provider value={contextValue}>
      <div className={cn('w-full', className)} {...props}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
};

export default Accordion;
