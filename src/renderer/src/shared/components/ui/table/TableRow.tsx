import React from 'react';
import { TableRowProps } from './Table.types';
import { cn } from '../../../../shared/utils/cn';

const TableRow: React.FC<TableRowProps> = ({
  children,
  className = '',
  onClick,
  style,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  showHorizontalDivider = false,
}) => {
  return (
    <tr
      className={cn(
        onClick && 'cursor-pointer',
        showHorizontalDivider && 'border-b border-table-border last:border-b-0',
        className,
      )}
      onClick={onClick}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {children}
    </tr>
  );
};

export default TableRow;
