import React, { useContext, useRef, useEffect } from 'react';
import { DropdownContentProps } from './Dropdown.types';
import { DropdownContext } from './DropdownContext';
import { cn } from '../../../../shared/utils/cn';

import { getPositionStyles, getDropdownSizeStyles } from './Dropdown.utils';

const DropdownContent: React.FC<DropdownContentProps> = ({
  children,
  className = '',
  maxHeight = '320px',
  minWidth = '200px',
  ...props
}) => {
  const context = useContext(DropdownContext);
  const contentRef = useRef<HTMLDivElement>(null);

  const { isOpen, setIsOpen, position = 'bottom-left', size = 'md' } = context || {};
  const sizeStyles = getDropdownSizeStyles(size);
  const positionStyles = getPositionStyles(position);

  useEffect(() => {
    if (!isOpen || !setIsOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(event.target as Node)) {
        // Check if click is on trigger (let Dropdown handle it)
        const target = event.target as HTMLElement;
        if (target.closest('[data-dropdown-trigger]')) {
          return;
        }
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, setIsOpen]);

  if (!context) {
    console.warn('DropdownContent must be used within Dropdown');
    return null;
  }

  if (!isOpen) return null;

  return (
    <div
      ref={contentRef}
      role="menu"
      className={cn(
        'absolute z-50',
        'rounded-lg shadow-lg',
        'overflow-auto',
        'animate-in fade-in-0 zoom-in-95',
        className,
      )}
      style={{
        ...positionStyles,
        padding: sizeStyles.padding,
        fontSize: sizeStyles.fontSize,
        maxHeight,
        minWidth,
      }}
      {...props}
    >
      <div className="flex flex-col" style={{ gap: sizeStyles.gap }}>
        {children}
      </div>
    </div>
  );
};

export default DropdownContent;
