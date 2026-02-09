import React from 'react';
import { TableHeaderProps } from './Table.types';
import { cn } from '../../../../shared/utils/cn';

const TableHeader: React.FC<TableHeaderProps> = ({ children, className = '' }) => {
  return <thead className={cn(className)}>{children}</thead>;
};

export default TableHeader;
