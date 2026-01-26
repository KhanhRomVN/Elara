import React, { useContext, useRef, useEffect } from 'react';
import { DropdownContentProps } from './Dropdown.types';
import { DropdownContext } from './DropdownContext';
import { cn } from '../../../lib/utils';
import { getPositionStyles, getDropdownSizeStyles } from './Dropdown.utils';

const DropdownContent: React.FC<DropdownContentProps> = ({
  children,
  className = '',
  maxHeight = '320px',
  minWidth = '140px',
  ...props
}) => {
  const context = useContext(DropdownContext);
  const contentRef = useRef<HTMLDivElement>(null);

  const {
    isOpen = false,
    setIsOpen = () => {},
    position = 'bottom-left',
    size = 'md',
  } = context || {};
  const sizeStyles = getDropdownSizeStyles(size as any);
  const positionStyles = getPositionStyles(position as any);

  useEffect(() => {
    if (!context || !isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(event.target as Node)) {
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

  if (!isOpen) return null;

  return (
    <div
      ref={contentRef}
      role="menu"
      className={cn(
        'absolute z-50',
        'rounded-lg border border-[var(--divider)] bg-[var(--dropdown-background)] text-[var(--text-primary)] shadow-[var(--dropdown-shadow)]',
        'overflow-auto',
        'animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2',
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
