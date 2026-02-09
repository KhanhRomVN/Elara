import React from 'react';
import { TableBodyProps } from './Table.types';
import { cn } from '../../../../shared/utils/cn';

const TableBody: React.FC<TableBodyProps> = ({ children, className = '' }) => {
  return <tbody className={cn(className)}>{children}</tbody>;
};

export default TableBody;
