import React, { useMemo } from 'react';
import { AccordionItemProps, AccordionContextValue } from './Accordion.types';
import { cn } from '../../../../shared/utils/cn';

import { AccordionContext, AccordionListContext } from './AccordionContext';
import Divider from '../divider/Divider';

const AccordionItem: React.FC<AccordionItemProps> = ({
  children,
  value,
  className = '',
  ...props
}) => {
  const parentContext = React.useContext(AccordionContext);
  const listContext = React.useContext(AccordionListContext);

  const contextValue: AccordionContextValue | null = useMemo(() => {
    if (!parentContext) return null;
    return {
      ...parentContext,
      currentValue: value,
      dividerColor: listContext?.dividerColor,
    };
  }, [parentContext, value, listContext?.dividerColor]);

  return (
    <AccordionContext.Provider value={contextValue}>
      <Divider
        orientation="horizontal"
        style="solid"
        thickness="thin"
        length={100}
        className={cn('first:hidden')}
      />
      <div
        className={cn('transition-colors duration-200', className)}
        data-value={value}
        {...props}
      >
        {children}
      </div>
    </AccordionContext.Provider>
  );
};

export default AccordionItem;
