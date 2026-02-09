import React, { useContext } from 'react';
import { TabItemProps } from './Tab.types';
import { TabContext } from './TabContext';
import { cn } from '../../../../shared/utils/cn';

const TabItem: React.FC<TabItemProps> = ({
  id,
  children,
  disabled = false,
  className = '',
  hoverClassName = '',
  activeClassName = '',
  icon,
  iconPosition = 'left',
  ...props
}) => {
  const context = useContext(TabContext);

  if (!context) {
    console.warn('TabItem must be used within Tab');
    return null;
  }

  const { activeTab, setActiveTab } = context;
  const isActive = activeTab === id;

  const handleClick = () => {
    if (!disabled) {
      setActiveTab(id);
    }
  };

  const renderIcon = () => {
    if (!icon) return null;

    // If icon is a LucideIcon (function component)
    if (typeof icon === 'function') {
      const IconComponent = icon as React.ComponentType<{ size?: number }>;
      return <IconComponent size={16} />;
    }

    // If icon is ReactNode
    return <span className="flex items-center justify-center">{icon}</span>;
  };

  const baseClasses = cn(
    'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors duration-200 cursor-pointer border-b-2',
    'border-transparent',
    disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
    className,
  );

  const hoverClasses = hoverClassName || 'hover:bg-gray-100 hover:border-gray-300';
  const activeClasses = activeClassName || 'border-blue-600 text-blue-600 bg-blue-50';

  return (
    <div
      role="tab"
      aria-selected={isActive}
      aria-disabled={disabled}
      className={cn(baseClasses, !disabled && hoverClasses, isActive && activeClasses)}
      onClick={handleClick}
      {...props}
    >
      {iconPosition === 'left' && renderIcon()}
      <span>{children}</span>
      {iconPosition === 'right' && renderIcon()}
    </div>
  );
};

export default TabItem;
