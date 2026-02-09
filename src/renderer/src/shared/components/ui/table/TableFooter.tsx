import React from 'react';
import { TableFooterProps } from './Table.types';
import { cn } from '../../../../shared/utils/cn';

const TableFooter: React.FC<TableFooterProps> = ({ children, className = '' }) => {
  return <tfoot className={cn(className)}>{children}</tfoot>;
};

export default TableFooter;
