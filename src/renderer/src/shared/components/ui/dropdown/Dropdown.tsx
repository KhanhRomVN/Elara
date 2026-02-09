import React, { useState, useEffect } from 'react';
import { DropdownProps, DropdownContextValue } from './Dropdown.types';
import { cn } from '../../../../shared/utils/cn';

import { DropdownContext } from './DropdownContext';

const Dropdown: React.FC<DropdownProps> = ({
  children,
  position = 'bottom-left',
  size = 'md',
  closeOnSelect = true,
  disabled = false,
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  className = '',
}) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);

  // Determine if component is controlled or uncontrolled
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const setIsOpen = (newOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(newOpen);
    }

    if (onOpenChange) {
      onOpenChange(newOpen);
    }
  };

  // Sync internal state with controlled prop
  useEffect(() => {
    if (isControlled) {
      setInternalOpen(controlledOpen);
    }
  }, [controlledOpen, isControlled]);

  const contextValue: DropdownContextValue = {
    isOpen,
    setIsOpen,
    position,
    size,
    closeOnSelect,
    disabled,
  };

  return (
    <DropdownContext.Provider value={contextValue}>
      <div className={cn('relative inline-block', className)}>{children}</div>
    </DropdownContext.Provider>
  );
};

export default Dropdown;
