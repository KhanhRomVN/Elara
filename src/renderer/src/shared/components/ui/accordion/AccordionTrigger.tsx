import React, { useContext } from 'react';
import { AccordionTriggerProps } from './Accordion.types';
import { AccordionContext } from './AccordionContext';
import { cn } from '../../../../shared/utils/cn';

import Divider from '../divider/Divider';

const AccordionTrigger: React.FC<AccordionTriggerProps> = ({
  children,
  className = '',
  ...props
}) => {
  const context = useContext(AccordionContext);

  if (!context) {
    console.warn('AccordionTrigger must be used within Accordion');
    return null;
  }

  const { toggleItem, isOpen, currentValue, dividerColor } = context;

  const handleClick = () => {
    if (currentValue) {
      toggleItem(currentValue);
    }
  };

  const isItemOpen = currentValue ? isOpen(currentValue) : false;

  return (
    <>
      <div
        onClick={handleClick}
        data-state={isItemOpen ? 'open' : 'closed'}
        className={cn('px-4 py-3 cursor-pointer', className)}
        {...props}
      >
        {typeof children === 'function' ? children({ isOpen: isItemOpen }) : children}
      </div>
      {isItemOpen && (
        <Divider
          orientation="horizontal"
          style="solid"
          thickness="thin"
          length={100}
          className={cn(dividerColor)}
        />
      )}
    </>
  );
};

export default AccordionTrigger;
