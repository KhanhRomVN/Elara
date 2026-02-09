import React, { useState, useRef, useEffect, Children } from 'react';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { BreadcrumbProps } from './Breadcrumb.types';
import { getBreadcrumbSizeStyles, getIconSize } from './Breadcrumb.utils';
import { cn } from '../../../../shared/utils/cn';

import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem } from '../dropdown';

const Breadcrumb: React.FC<BreadcrumbProps> = ({
  children,
  separator: SeparatorIcon = ChevronRight,
  size = 100,
  className = '',
  ...props
}) => {
  const [isOverflowing, setIsOverflowing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  const sizeStyles = getBreadcrumbSizeStyles(size);
  const iconSize = getIconSize(size);

  const childrenArray = Children.toArray(children);
  const totalItems = childrenArray.length;

  useEffect(() => {
    const checkOverflow = () => {
      if (navRef.current && containerRef.current) {
        const navWidth = navRef.current.scrollWidth;
        const containerWidth = containerRef.current.clientWidth;
        setIsOverflowing(navWidth > containerWidth);
      }
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [children]);

  const renderCollapsedBreadcrumb = () => {
    const firstItem = childrenArray[0];
    const lastItem = childrenArray[totalItems - 1];
    const hiddenItems = childrenArray.slice(1, totalItems - 1);

    return (
      <>
        {React.cloneElement(firstItem as React.ReactElement, {
          _isActive: false,
          _size: size,
        })}

        <span className="breadcrumb-separator flex items-center" style={sizeStyles}>
          <SeparatorIcon size={iconSize} />
        </span>

        <Dropdown size="sm">
          <DropdownTrigger>
            <button
              className="breadcrumb-item breadcrumb-link flex items-center transition-colors"
              style={sizeStyles}
            >
              <MoreHorizontal size={iconSize} />
            </button>
          </DropdownTrigger>
          <DropdownContent className="bg-white dark:bg-gray-800 border">
            {hiddenItems.map((item, index) => {
              const itemProps = (item as React.ReactElement).props;
              const IconComponent = itemProps.icon;
              const iconElement = IconComponent ? <IconComponent size={iconSize} /> : null;

              return (
                <DropdownItem
                  key={index}
                  leftIcon={iconElement}
                  onClick={itemProps.onClick}
                  className="hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {itemProps.href ? (
                    <a href={itemProps.href} className="block w-full">
                      {itemProps.text}
                    </a>
                  ) : (
                    itemProps.text
                  )}
                </DropdownItem>
              );
            })}
          </DropdownContent>
        </Dropdown>

        <span className="breadcrumb-separator flex items-center" style={sizeStyles}>
          <SeparatorIcon size={iconSize} />
        </span>

        {React.cloneElement(lastItem as React.ReactElement, {
          _isActive: true,
          _size: size,
        })}
      </>
    );
  };

  const renderNormalBreadcrumb = () => {
    return childrenArray.map((child, index) => {
      const isLast = index === totalItems - 1;
      return (
        <React.Fragment key={index}>
          {React.cloneElement(child as React.ReactElement, {
            _isActive: isLast,
            _size: size,
          })}
          {!isLast && (
            <span className="breadcrumb-separator flex items-center" style={sizeStyles}>
              <SeparatorIcon size={iconSize} />
            </span>
          )}
        </React.Fragment>
      );
    });
  };

  return (
    <div ref={containerRef} className={cn('breadcrumb-container w-full', className)}>
      <nav ref={navRef} className="breadcrumb-base" aria-label="Breadcrumb" {...props}>
        <ol className="breadcrumb-list flex items-center gap-2 list-none m-0 p-0">
          {isOverflowing && totalItems > 2 ? renderCollapsedBreadcrumb() : renderNormalBreadcrumb()}
        </ol>
      </nav>
    </div>
  );
};

export default Breadcrumb;
