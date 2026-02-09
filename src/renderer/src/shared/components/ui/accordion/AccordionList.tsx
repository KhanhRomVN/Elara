import React from 'react';
import { AccordionListProps } from './Accordion.types';
import { cn } from '../../../../shared/utils/cn';

import { AccordionListContext } from './AccordionContext';

const AccordionList: React.FC<AccordionListProps> = ({
  children,
  dividerColor = '',
  className = '',
  ...props
}) => {
  return (
    <AccordionListContext.Provider value={{ dividerColor }}>
      <div
        className={cn('flex flex-col', 'border rounded-md overflow-hidden', className)}
        {...props}
      >
        {children}
      </div>
    </AccordionListContext.Provider>
  );
};

export default AccordionList;
