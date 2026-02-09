import React from 'react';
import { TableCellProps } from './Table.types';
import { cn } from '../../../../shared/utils/cn';

const TableCell: React.FC<TableCellProps> = ({
  children,
  className = '',
  align = 'left',
  colSpan,
  style,
  onClick,
  showVerticalDivider = false,
  showHorizontalDivider = false,
}) => {
  return (
    <td
      className={cn(
        'py-3 px-4',
        align === 'left' && 'text-left',
        align === 'center' && 'text-center',
        align === 'right' && 'text-right',
        showVerticalDivider && 'border-r border-table-border last:border-r-0',
        showHorizontalDivider && 'border-b border-table-border',
        className,
      )}
      colSpan={colSpan}
      style={style}
      onClick={onClick}
    >
      {children}
    </td>
  );
};

export default TableCell;
