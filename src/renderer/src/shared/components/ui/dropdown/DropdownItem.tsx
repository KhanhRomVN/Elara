import React, { useContext } from 'react';
import { DropdownItemProps } from './Dropdown.types';
import { DropdownContext } from './DropdownContext';
import { cn } from '../../../../shared/utils/cn';
import { getIconSize } from './Dropdown.utils';

const DropdownItem: React.FC<DropdownItemProps> = ({
  children,
  disabled = false,
  onClick,
  className = '',
  leftIcon,
  rightIcon,
  ...props
}) => {
  const context = useContext(DropdownContext);

  if (!context) {
    console.warn('DropdownItem must be used within Dropdown');
    return null;
  }

  const { setIsOpen, closeOnSelect, size } = context;
  const iconSize = getIconSize(size);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;

    if (onClick) {
      onClick(e);
    }

    if (closeOnSelect) {
      setIsOpen(false);
    }
  };

  const renderIcon = (icon: React.ReactNode, iconSize: number) => {
    if (!icon) return null;

    // Nếu icon là LucideIcon (function component)
    if (typeof icon === 'function') {
      const IconComponent = icon as React.ComponentType<{ size?: number }>;
      return <IconComponent size={iconSize} />;
    }

    // Nếu icon là ReactNode (emoji, SVG, text, React element, etc.)
    return (
      <span
        className="dropdown-icon-content"
        style={{
          fontSize: `${iconSize}px`,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </span>
    );
  };

  return (
    <div
      role="menuitem"
      aria-disabled={disabled}
      className={cn(
        'flex items-center justify-between gap-3 cursor-pointer transition-colors',
        'px-3 py-2 rounded-md',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
        className,
      )}
      onClick={handleClick}
      {...props}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {leftIcon && (
          <div className="flex-shrink-0 flex items-center justify-center">
            {renderIcon(leftIcon, iconSize)}
          </div>
        )}
        <div className="flex-1 min-w-0">{children}</div>
      </div>

      {rightIcon && (
        <div className="flex-shrink-0 flex items-center justify-center ml-auto">
          {renderIcon(rightIcon, iconSize)}
        </div>
      )}
    </div>
  );
};

export default DropdownItem;
