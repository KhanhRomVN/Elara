import React from 'react';
import { BreadcrumbItemProps } from './Breadcrumb.types';
import { getBreadcrumbSizeStyles, getIconSize } from './Breadcrumb.utils';
import { cn } from '../../../../shared/utils/cn';

interface ExtendedBreadcrumbItemProps extends BreadcrumbItemProps {
  _isActive?: boolean;
  _size?: number;
}

const BreadcrumbItem: React.FC<ExtendedBreadcrumbItemProps> = ({
  icon: IconComponent, // Đổi tên để sử dụng trực tiếp
  text,
  href,
  onClick,
  className = '',
  _isActive = false,
  _size = 100,
  ...props
}) => {
  const sizeStyles = getBreadcrumbSizeStyles(_size);
  const iconSize = getIconSize(_size);

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick();
    }
  };

  const baseClasses = cn(
    'breadcrumb-item flex items-center',
    _isActive ? 'font-medium cursor-default' : 'transition-colors cursor-pointer',
    className,
  );

  const iconElement = IconComponent ? <IconComponent size={iconSize} /> : null;

  const content = (
    <span className="flex items-center gap-2">
      {iconElement}
      <span>{text}</span>
    </span>
  );

  if (_isActive) {
    return (
      <li className={baseClasses} style={sizeStyles} {...props}>
        {content}
      </li>
    );
  }

  if (href) {
    return (
      <li className={baseClasses} style={sizeStyles} {...props}>
        <a href={href} onClick={handleClick} className="breadcrumb-link flex items-center gap-2">
          {content}
        </a>
      </li>
    );
  }

  return (
    <li className={baseClasses} style={sizeStyles} onClick={handleClick} {...props}>
      {content}
    </li>
  );
};

export default BreadcrumbItem;
