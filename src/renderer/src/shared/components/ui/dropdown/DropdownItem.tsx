import React, { useContext } from 'react';
import { DropdownItemProps } from './Dropdown.types';
import { DropdownContext } from './DropdownContext';
import { cn } from '../../../lib/utils';
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

  const handleClick = () => {
    if (disabled) return;

    if (onClick) {
      onClick();
    }

    if (closeOnSelect) {
      setIsOpen(false);
    }
  };

  const renderIcon = (icon: React.ReactNode, iconSize: number) => {
    if (!icon) return null;

    if (typeof icon === 'function') {
      const IconComponent = icon as React.ComponentType<{ size?: number }>;
      return <IconComponent size={iconSize} />;
    }

    return (
      <span
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
        'hover:bg-[var(--dropdown-item-hover)] text-[var(--text-primary)]',
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
        <div className="flex-1 min-w-0 font-medium">{children}</div>
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
