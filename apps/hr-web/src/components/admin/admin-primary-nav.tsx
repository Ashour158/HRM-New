import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ADMIN_MORE_LINKS,
  ADMIN_MORE_MODULE,
  ADMIN_PRIMARY_MODULES,
  type AdminNavLink,
  type AdminNavModule,
} from '@/lib/admin-nav-modules';

function isLinkActive(pathname: string, link: AdminNavLink) {
  if (link.path === '/admin') return pathname === '/admin';
  return pathname === link.path || pathname.startsWith(`${link.path}/`);
}

const triggerClassName =
  'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const inactiveClassName = 'text-slate-600 hover:bg-white/60 hover:text-slate-900';
const activeClassName = 'bg-white/80 text-indigo-700 shadow-sm';

interface AdminNavGroupProps {
  id: string;
  label: string;
  icon: React.ElementType;
  visibleLinks: AdminNavLink[];
  isActive: boolean;
  align: 'start' | 'end';
}

function AdminNavGroup({ id, label, icon: Icon, visibleLinks, isActive, align }: AdminNavGroupProps) {
  if (visibleLinks.length === 0) return null;

  if (visibleLinks.length === 1) {
    return (
      <Link
        to={visibleLinks[0].path}
        className={cn(triggerClassName, isActive ? activeClassName : inactiveClassName)}
      >
        <Icon className={cn('h-4 w-4', isActive ? 'text-indigo-600' : 'text-slate-400')} aria-hidden="true" />
        {label}
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-nav-module={id}
          aria-label={`${label} menu`}
          className={cn(triggerClassName, isActive ? activeClassName : inactiveClassName)}
        >
          <Icon className={cn('h-4 w-4', isActive ? 'text-indigo-600' : 'text-slate-400')} aria-hidden="true" />
          {label}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="max-h-[70vh] min-w-[220px] overflow-y-auto">
        {visibleLinks.map((link) => (
          <DropdownMenuItem key={link.path} asChild>
            <Link to={link.path}>{link.label}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface AdminPrimaryNavProps {
  /** Whether the current user can see system-console-gated tooling. */
  canSeeSystemConsole: boolean;
  className?: string;
}

/**
 * Zoho-inspired always-visible primary bar for the admin portal: 11 module
 * tabs (each linking directly or expanding into its member pages) plus a
 * trailing "More" flyout for platform/ops-only tooling. Purely a navigation
 * shell - no route paths are introduced or changed here, it only links to
 * routes already registered in routes/index.tsx.
 */
export function AdminPrimaryNav({ canSeeSystemConsole, className }: AdminPrimaryNavProps) {
  const location = useLocation();

  const visibleLinksFor = React.useCallback(
    (links: AdminNavLink[]) => links.filter((link) => !link.systemOnly || canSeeSystemConsole),
    [canSeeSystemConsole],
  );

  const moduleActive = React.useCallback(
    (module: AdminNavModule) => module.links.some((link) => isLinkActive(location.pathname, link)),
    [location.pathname],
  );

  const moreVisibleLinks = visibleLinksFor(ADMIN_MORE_LINKS);
  const moreActive = ADMIN_MORE_LINKS.some((link) => isLinkActive(location.pathname, link));

  return (
    <nav aria-label="Admin modules" className={cn('w-full overflow-x-auto', className)}>
      <ul className="flex items-center gap-1 px-1 py-1.5">
        {ADMIN_PRIMARY_MODULES.map((module) => (
          <li key={module.id}>
            <AdminNavGroup
              id={module.id}
              label={module.label}
              icon={module.icon}
              visibleLinks={visibleLinksFor(module.links)}
              isActive={moduleActive(module)}
              align="start"
            />
          </li>
        ))}
        {moreVisibleLinks.length > 0 ? (
          <li>
            <AdminNavGroup
              id={ADMIN_MORE_MODULE.id}
              label={ADMIN_MORE_MODULE.label}
              icon={ADMIN_MORE_MODULE.icon}
              visibleLinks={moreVisibleLinks}
              isActive={moreActive}
              align="end"
            />
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
