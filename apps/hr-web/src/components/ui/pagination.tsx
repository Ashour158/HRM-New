import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  const safePageCount = Math.max(pageCount, 1);
  return (
    <nav className="flex items-center justify-between gap-3" aria-label="Pagination">
      <Button type="button" variant="outline" size="sm" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft aria-hidden="true" />
        Previous
      </Button>
      <span className="text-sm font-semibold text-muted-foreground">Page {page} of {safePageCount}</span>
      <Button type="button" variant="outline" size="sm" aria-label="Next page" disabled={page >= safePageCount} onClick={() => onPageChange(page + 1)}>
        Next
        <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  );
}
