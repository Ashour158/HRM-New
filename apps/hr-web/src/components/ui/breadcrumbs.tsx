import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <Link className="font-semibold hover:text-foreground" to={item.href}>{item.label}</Link>
              ) : (
                <span className="font-semibold text-foreground" aria-current={isLast ? 'page' : undefined}>{item.label}</span>
              )}
              {!isLast ? <ChevronRight aria-hidden="true" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
