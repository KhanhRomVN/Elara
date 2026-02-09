import React from 'react';
import { HeaderCellProps } from './Table.types';
import { cn } from '../../../../shared/utils/cn';

import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

const HeaderCell: React.FC<HeaderCellProps> = ({
  children,
  className = '',
  align = 'left',
  colSpan,
  style,
  onClick,
  showVerticalDivider = false,
  showHorizontalDivider = false,
  sortable = false,
  sortDirection = null,
  onSort,
}) => {
  const handleClick = () => {
    if (sortable && onSort) {
      onSort();
    }
    if (onClick) {
      onClick();
    }
  };

  const getSortIcon = () => {
    if (!sortable) return null;

    if (sortDirection === 'asc') {
      return <ArrowUp size={16} className="text-green-600" />;
    } else if (sortDirection === 'desc') {
      return <ArrowDown size={16} className="text-red-600" />;
    } else {
      return <ArrowUpDown size={16} className="text-gray-400" />;
    }
  };

  return (
    <th
      className={cn(
        'py-3 px-4 font-semibold',
        align === 'left' && 'text-left',
        align === 'center' && 'text-center',
        align === 'right' && 'text-right',
        showVerticalDivider && 'border-r border-table-border last:border-r-0',
        showHorizontalDivider && 'border-b border-table-border',
        sortable && 'cursor-pointer select-none hover:bg-table-hoverHeaderBg transition-colors',
        className,
      )}
      colSpan={colSpan}
      style={style}
      onClick={handleClick}
    >
      <div className="flex items-center justify-between gap-2">
        <span>{children}</span>
        {getSortIcon()}
      </div>
    </th>
  );
};

export default HeaderCell;
