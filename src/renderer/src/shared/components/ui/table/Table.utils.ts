import { TableSize, TableSort, TableColumn, TablePagination } from './Table.types';
import { CSSProperties } from 'react';

/**
 * Get table size classes
 */
export const getTableSizeClasses = (size: TableSize = 'md'): string => {
  const sizeMap: Record<TableSize, string> = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return sizeMap[size];
};

/**
 * Sort data based on sort configuration
 */
export const sortData = <T extends Record<string, any>>(
  data: T[],
  columns: TableColumn<T>[],
  sort: TableSort | null,
): T[] => {
  if (!sort) return data;

  const sortedData = [...data];
  const column = columns.find((col) => col.key === sort.key);

  if (column?.sorter) {
    sortedData.sort((a, b) => {
      const result = column.sorter!(a, b);
      return sort.direction === 'asc' ? result : -result;
    });
  } else {
    // Default string/number sorting
    sortedData.sort((a, b) => {
      const aValue = a[sort.key];
      const bValue = b[sort.key];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sort.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (aValue < bValue) return sort.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  return sortedData;
};

/**
 * Paginate data
 */
export const paginateData = <T>(data: T[], pagination?: TablePagination): T[] => {
  if (!pagination) return data;

  const { current, pageSize } = pagination;
  const startIndex = (current - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  return data.slice(startIndex, endIndex);
};

/**
 * Generate page numbers for pagination
 */
export const generatePageNumbers = (current: number, totalPages: number): (number | string)[] => {
  const delta = 2;
  const range: (number | string)[] = [];
  const rangeWithDots: (number | string)[] = [];

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= current - delta && i <= current + delta)) {
      range.push(i);
    }
  }

  let last = 0;
  for (const i of range) {
    if (last) {
      if (Number(i) - last === 2) {
        rangeWithDots.push(last + 1);
      } else if (Number(i) - last !== 1) {
        rangeWithDots.push('...');
      }
    }
    rangeWithDots.push(i);
    last = Number(i);
  }

  return rangeWithDots;
};
