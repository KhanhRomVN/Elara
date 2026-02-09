import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { PaginationProps } from './Pagination.types';
import {
  calculatePaginationInfo,
  generatePageItems,
  validatePaginationProps,
  getPaginationSizeStyles,
} from './Pagination.utils';
import { cn } from '../../../../shared/utils/cn';

const Pagination: React.FC<PaginationProps> = ({
  totalItems,
  itemsPerPage,
  currentPage,
  onPageChange,
  variant = 'classic',
  size = 'md',
  align = 'center',
  className = '',
}) => {
  // Validate props
  const validation = validatePaginationProps({
    totalItems,
    itemsPerPage,
    currentPage,
    onPageChange,
  });

  if (!validation.isValid) {
    console.error('Pagination validation errors:', validation.errors);
    return null;
  }

  // Calculate pagination info
  const paginationInfo = calculatePaginationInfo(totalItems, itemsPerPage, currentPage);

  const totalPages = paginationInfo.totalPages;

  // Get size styles
  const sizeStyles = getPaginationSizeStyles(size);

  // Handle page change
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };

  // Alignment classes
  const alignmentClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  };

  // Variant 1: Classic Outlined
  const ClassicPagination = () => {
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

    return (
      <div className={cn('flex items-center', sizeStyles.gap, className)}>
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={!paginationInfo.hasPrevious}
          className={cn(
            sizeStyles.button,
            'border border-border-default rounded hover:bg-input-background disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          <ChevronLeft size={sizeStyles.iconSize} />
        </button>
        {pages.map((page) => (
          <button
            key={page}
            onClick={() => handlePageChange(page)}
            className={cn(
              sizeStyles.button,
              'border rounded transition-colors',
              page === currentPage
                ? 'bg-button-primary text-button-primary-text border-button-primary'
                : 'border-border-default hover:bg-input-background',
            )}
          >
            {page}
          </button>
        ))}
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={!paginationInfo.hasNext}
          className={cn(
            sizeStyles.button,
            'border border-border-default rounded hover:bg-input-background disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          <ChevronRight size={sizeStyles.iconSize} />
        </button>
      </div>
    );
  };

  // Variant 2: Minimal Dots
  const MinimalDotsPagination = () => {
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

    return (
      <div className={cn('flex items-center', sizeStyles.gap, className)}>
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={!paginationInfo.hasPrevious}
          className="text-text-secondary hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={sizeStyles.iconSize} />
        </button>
        <div className={cn('flex items-center', sizeStyles.gap)}>
          {pages.map((page) => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={cn(
                'transition-all flex items-center justify-center',
                page === currentPage
                  ? cn(
                      sizeStyles.activeDotSize,
                      sizeStyles.text,
                      'rounded-full bg-button-primary text-button-primary-text font-medium',
                    )
                  : cn(
                      sizeStyles.dotSize,
                      'rounded-full bg-border-default hover:bg-text-secondary',
                    ),
              )}
            >
              {page === currentPage && <span>{page}</span>}
            </button>
          ))}
        </div>
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={!paginationInfo.hasNext}
          className="text-text-secondary hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight size={sizeStyles.iconSize} />
        </button>
      </div>
    );
  };

  // Variant 3: Pill Group
  const PillGroupPagination = () => {
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

    return (
      <div
        className={cn('inline-flex items-center bg-input-background rounded-full p-1', className)}
      >
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={!paginationInfo.hasPrevious}
          className={cn(
            sizeStyles.pillButton,
            'rounded-full hover:bg-card-background transition disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          <ChevronLeft size={sizeStyles.iconSize} />
        </button>
        {pages.map((page) => (
          <button
            key={page}
            onClick={() => handlePageChange(page)}
            className={cn(
              sizeStyles.pillPage,
              'rounded-full transition',
              page === currentPage
                ? 'bg-card-background shadow-sm font-semibold'
                : 'hover:bg-card-background/50',
            )}
          >
            {page}
          </button>
        ))}
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={!paginationInfo.hasNext}
          className={cn(
            sizeStyles.pillButton,
            'rounded-full hover:bg-card-background transition disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          <ChevronRight size={sizeStyles.iconSize} />
        </button>
      </div>
    );
  };

  // Variant 4: Card Style
  const CardStylePagination = () => {
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

    return (
      <div className={cn('flex items-center', sizeStyles.gap, className)}>
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={!paginationInfo.hasPrevious}
          className={cn(
            sizeStyles.cardSize,
            'flex items-center justify-center bg-card-background shadow rounded-lg hover:shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          <ChevronLeft size={sizeStyles.iconSize} />
        </button>
        {pages.map((page) => (
          <button
            key={page}
            onClick={() => handlePageChange(page)}
            className={cn(
              sizeStyles.cardSize,
              'flex items-center justify-center rounded-lg transition',
              page === currentPage
                ? 'bg-button-primary text-button-primary-text shadow-lg'
                : 'bg-card-background shadow hover:shadow-md',
            )}
          >
            {page}
          </button>
        ))}
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={!paginationInfo.hasNext}
          className={cn(
            sizeStyles.cardSize,
            'flex items-center justify-center bg-card-background shadow rounded-lg hover:shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          <ChevronRight size={sizeStyles.iconSize} />
        </button>
      </div>
    );
  };

  // Variant 5: Compact with Ellipsis
  const CompactEllipsisPagination = () => {
    const renderPages = () => {
      const pages: (number | string)[] = [];

      // First page
      pages.push(1);

      // Ellipsis and middle pages
      if (currentPage > 3) pages.push('...');

      for (
        let i = Math.max(2, currentPage - 1);
        i <= Math.min(totalPages - 1, currentPage + 1);
        i++
      ) {
        pages.push(i);
      }

      // Ellipsis and last page
      if (currentPage < totalPages - 2) pages.push('...');
      if (totalPages > 1) pages.push(totalPages);

      return pages;
    };

    return (
      <div
        className={cn(
          'flex items-center gap-1 border border-border-default rounded-lg p-1 bg-card-background',
          className,
        )}
      >
        <button
          onClick={() => handlePageChange(1)}
          disabled={currentPage === 1}
          className={cn(
            sizeStyles.button,
            'hover:bg-input-background rounded disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          <ChevronsLeft size={sizeStyles.iconSize} />
        </button>
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={!paginationInfo.hasPrevious}
          className={cn(
            sizeStyles.button,
            'hover:bg-input-background rounded disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          <ChevronLeft size={sizeStyles.iconSize} />
        </button>
        <div className="flex items-center">
          {renderPages().map((page, idx) => (
            <button
              key={idx}
              onClick={() => typeof page === 'number' && handlePageChange(page)}
              className={cn(
                sizeStyles.button,
                'min-w-[32px]',
                page === currentPage
                  ? 'bg-button-primary text-button-primary-text rounded'
                  : page === '...'
                    ? 'cursor-default'
                    : 'hover:bg-input-background rounded',
              )}
              disabled={page === '...'}
            >
              {page}
            </button>
          ))}
        </div>
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={!paginationInfo.hasNext}
          className={cn(
            sizeStyles.button,
            'hover:bg-input-background rounded disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          <ChevronRight size={sizeStyles.iconSize} />
        </button>
        <button
          onClick={() => handlePageChange(totalPages)}
          disabled={currentPage === totalPages}
          className={cn(
            sizeStyles.button,
            'hover:bg-input-background rounded disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          <ChevronsRight size={sizeStyles.iconSize} />
        </button>
      </div>
    );
  };

  // Variant 6: Dropdown Style
  const DropdownPagination = () => {
    return (
      <div className={cn('flex items-center gap-4', className)}>
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={!paginationInfo.hasPrevious}
          className={cn(
            sizeStyles.navButton,
            'bg-button-primary text-button-primary-text rounded-lg hover:opacity-90 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          <ChevronLeft size={sizeStyles.iconSize} />
          Trước
        </button>

        <div className="flex items-center gap-2">
          <span className={cn(sizeStyles.text, 'text-text-secondary')}>Trang</span>
          <select
            value={currentPage}
            onChange={(e) => handlePageChange(Number(e.target.value))}
            className={cn(
              sizeStyles.button,
              'border border-border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-button-primary bg-card-background',
            )}
          >
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <option key={page} value={page}>
                {page}
              </option>
            ))}
          </select>
          <span className={cn(sizeStyles.text, 'text-text-secondary')}>trong {totalPages}</span>
        </div>

        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={!paginationInfo.hasNext}
          className={cn(
            sizeStyles.navButton,
            'bg-button-primary text-button-primary-text rounded-lg hover:opacity-90 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          Sau
          <ChevronRight size={sizeStyles.iconSize} />
        </button>
      </div>
    );
  };

  // Variant 7: Progress Bar Style
  const ProgressBarPagination = () => {
    const progress = (currentPage / totalPages) * 100;

    return (
      <div className={cn('w-full max-w-md', className)}>
        <div className="flex justify-between items-center mb-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={!paginationInfo.hasPrevious}
            className={cn(
              sizeStyles.button,
              'bg-button-primary text-button-primary-text rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            <ChevronLeft size={sizeStyles.iconSize} />
          </button>
          <span className={cn(sizeStyles.text, 'font-medium text-text-primary')}>
            Trang {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={!paginationInfo.hasNext}
            className={cn(
              sizeStyles.button,
              'bg-button-primary text-button-primary-text rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            <ChevronRight size={sizeStyles.iconSize} />
          </button>
        </div>
        <div className="w-full bg-input-background rounded-full h-2">
          <div
            className="bg-gradient-to-r from-button-primary to-button-primary h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-text-secondary">Đầu</span>
          <span className="text-xs text-text-secondary">Cuối</span>
        </div>
      </div>
    );
  };

  // Variant 8: Slider Style
  const SliderPagination = () => {
    return (
      <div className={cn('w-full max-w-md', className)}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={!paginationInfo.hasPrevious}
            className={cn(
              sizeStyles.pageNumber,
              'shrink-0 flex items-center justify-center bg-button-primary text-button-primary-text rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            <ChevronLeft size={sizeStyles.iconSize} />
          </button>

          <div className="flex-1">
            <input
              type="range"
              min="1"
              max={totalPages}
              value={currentPage}
              onChange={(e) => handlePageChange(Number(e.target.value))}
              className="w-full h-2 bg-input-background rounded-lg appearance-none cursor-pointer accent-button-primary"
            />
            <div className="flex justify-between mt-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <span
                  key={page}
                  className={cn(
                    'text-xs',
                    page === currentPage ? 'text-button-primary font-bold' : 'text-text-secondary',
                  )}
                >
                  {page}
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={!paginationInfo.hasNext}
            className={cn(
              sizeStyles.pageNumber,
              'shrink-0 flex items-center justify-center bg-button-primary text-button-primary-text rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            <ChevronRight size={sizeStyles.iconSize} />
          </button>
        </div>
      </div>
    );
  };

  // Render based on variant
  const renderVariant = () => {
    switch (variant) {
      case 'classic':
        return <ClassicPagination />;
      case 'minimal-dots':
        return <MinimalDotsPagination />;
      case 'pill':
        return <PillGroupPagination />;
      case 'card':
        return <CardStylePagination />;
      case 'compact':
        return <CompactEllipsisPagination />;
      case 'dropdown':
        return <DropdownPagination />;
      case 'progress':
        return <ProgressBarPagination />;
      case 'slider':
        return <SliderPagination />;
      default:
        return <ClassicPagination />;
    }
  };

  return <div className={cn('flex', alignmentClasses[align])}>{renderVariant()}</div>;
};

export default Pagination;
