import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ModelsPaginationProps {
  currentPage: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export const ModelsPagination = ({
  currentPage,
  totalPages,
  startIndex,
  endIndex,
  totalItems,
  onPageChange,
}: ModelsPaginationProps) => {
  if (totalItems === 0) return null;

  return (
    <div className="flex items-center justify-between px-4 py-4 border-t">
      <div className="text-sm text-muted-foreground">
        Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} models
      </div>
      <div className="flex items-center space-x-2">
        <button
          className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-4 disabled:opacity-50 transition-colors"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </button>
        <div className="text-sm font-medium px-2">
          Page {currentPage} of {totalPages}
        </div>
        <button
          className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-4 disabled:opacity-50 transition-colors"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </button>
      </div>
    </div>
  );
};
