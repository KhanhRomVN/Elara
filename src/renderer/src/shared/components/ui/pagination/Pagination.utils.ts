import { PaginationInfo, PageItem, PaginationSize, PaginationAlign } from './Pagination.types';

/**
 * Calculate pagination information
 */
export const calculatePaginationInfo = (
  totalItems: number,
  itemsPerPage: number,
  currentPage: number,
): PaginationInfo => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);
  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return {
    totalPages,
    startItem,
    endItem,
    hasPrevious,
    hasNext,
  };
};

/**
 * Generate page items for display
 */
export const generatePageItems = (
  currentPage: number,
  totalPages: number,
  maxVisiblePages: number = 7,
): PageItem[] => {
  if (totalPages <= maxVisiblePages) {
    return Array.from({ length: totalPages }, (_, i) => ({
      type: 'page' as const,
      page: i + 1,
      isCurrent: i + 1 === currentPage,
      isDisabled: false,
    }));
  }

  const items: PageItem[] = [];
  const half = Math.floor(maxVisiblePages / 2);
  let start = Math.max(1, currentPage - half);
  const end = Math.min(totalPages, start + maxVisiblePages - 1);

  if (end - start + 1 < maxVisiblePages) {
    start = Math.max(1, end - maxVisiblePages + 1);
  }

  // First page
  if (start > 1) {
    items.push({
      type: 'page',
      page: 1,
      isCurrent: false,
      isDisabled: false,
    });
  }

  // Left ellipsis
  if (start > 2) {
    items.push({
      type: 'ellipsis',
      page: start - 1,
      isCurrent: false,
      isDisabled: true,
    });
  }

  // Page numbers
  for (let i = start; i <= end; i++) {
    items.push({
      type: 'page',
      page: i,
      isCurrent: i === currentPage,
      isDisabled: false,
    });
  }

  // Right ellipsis
  if (end < totalPages - 1) {
    items.push({
      type: 'ellipsis',
      page: end + 1,
      isCurrent: false,
      isDisabled: true,
    });
  }

  // Last page
  if (end < totalPages) {
    items.push({
      type: 'page',
      page: totalPages,
      isCurrent: false,
      isDisabled: false,
    });
  }

  return items;
};

/**
 * Get pagination size styles
 */
export const getPaginationSizeStyles = (size: PaginationSize) => {
  const sizes = {
    sm: {
      button: 'px-2 py-1 text-sm',
      pageNumber: 'w-6 h-6 text-xs',
      gap: 'gap-1',
      iconSize: 14,
      dotSize: 'w-1.5 h-1.5',
      activeDotSize: 'w-6 h-6',
      cardSize: 'w-8 h-8',
      pillButton: 'px-2 py-1',
      pillPage: 'px-3 py-1',
      navButton: 'px-3 py-1.5',
      text: 'text-xs',
    },
    md: {
      button: 'px-3 py-2 text-base',
      pageNumber: 'w-8 h-8 text-sm',
      gap: 'gap-2',
      iconSize: 16,
      dotSize: 'w-2 h-2',
      activeDotSize: 'w-8 h-8',
      cardSize: 'w-10 h-10',
      pillButton: 'px-3 py-2',
      pillPage: 'px-4 py-2',
      navButton: 'px-4 py-2',
      text: 'text-sm',
    },
    lg: {
      button: 'px-4 py-3 text-lg',
      pageNumber: 'w-10 h-10 text-base',
      gap: 'gap-3',
      iconSize: 20,
      dotSize: 'w-2.5 h-2.5',
      activeDotSize: 'w-10 h-10',
      cardSize: 'w-12 h-12',
      pillButton: 'px-4 py-3',
      pillPage: 'px-5 py-3',
      navButton: 'px-5 py-3',
      text: 'text-base',
    },
  };

  return sizes[size];
};

/**
 * Get pagination alignment styles
 */
export const getPaginationAlignmentStyles = (align: PaginationAlign) => {
  const alignments = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  };

  return alignments[align];
};

/**
 * Validate pagination props
 */
export const validatePaginationProps = (props: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (props.totalItems === undefined || props.totalItems < 0) {
    errors.push('totalItems must be a non-negative number');
  }

  if (props.itemsPerPage === undefined || props.itemsPerPage <= 0) {
    errors.push('itemsPerPage must be a positive number');
  }

  if (props.currentPage === undefined || props.currentPage <= 0) {
    errors.push('currentPage must be a positive number');
  }

  if (props.onPageChange === undefined) {
    errors.push('onPageChange callback is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
