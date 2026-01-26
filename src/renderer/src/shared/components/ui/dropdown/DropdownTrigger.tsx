import React, { useContext } from 'react';
import { DropdownTriggerProps } from './Dropdown.types';
import { DropdownContext } from './DropdownContext';
import { cn } from '../../../lib/utils';

const DropdownTrigger: React.FC<DropdownTriggerProps> = ({
  children,
  className = '',
  ...props
}) => {
  const context = useContext(DropdownContext);

  if (!context) {
    console.warn('DropdownTrigger must be used within Dropdown');
    return null;
  }

  const { isOpen, setIsOpen, disabled } = context;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div
      data-dropdown-trigger
      className={cn(
        'inline-flex cursor-pointer transition-all',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
      onClick={handleClick}
      {...props}
    >
      {children}
    </div>
  );
};

export default DropdownTrigger;
