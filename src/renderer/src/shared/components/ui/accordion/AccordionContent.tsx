import React, { useContext } from 'react';
import { AccordionContentProps } from './Accordion.types';
import { AccordionContext } from './AccordionContext';
import { cn } from '../../../../shared/utils/cn';

const AccordionContent: React.FC<AccordionContentProps> = ({
  children,
  className = '',
  ...props
}) => {
  const context = useContext(AccordionContext);

  if (!context) {
    console.warn('AccordionContent must be used within Accordion');
    return null;
  }

  const { isOpen, currentValue } = context;

  const isItemOpen = currentValue ? isOpen(currentValue) : false;

  if (!isItemOpen) return null;

  return (
    <div data-state="open" className={cn('px-4 py-3', className)} {...props}>
      {children}
    </div>
  );
};

export default AccordionContent;
