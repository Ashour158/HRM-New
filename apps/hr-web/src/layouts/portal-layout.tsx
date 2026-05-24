import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PortalNavItem {
  label: string;
  path: string;
  badge?: number;
}

interface PortalConfig {
  title: string;
  description: string;
  navItems: PortalNavItem[];
  theme: 'employee' | 'manager' | 'admin';
}

const portalConfigs: Record<string, PortalConfig> = {
  employee: {
    title: 'Employee Self-Service',
    description: 'Manage your personal information, benefits, and time off',
    theme: 'employee',
    navItems: [
      { label: 'Dashboard', path: '/employee' },
      { label: 'Profile', path: '/employee/profile' },
      { label: 'Payslips', path: '/employee/payslip' },
      { label: 'Benefits', path: '/employee/benefits' },
      { label: 'Time Off', path: '/employee/time-off' },
    ],
  },
  manager: {
    title: 'Manager Self-Service',
    description: 'Manage your team, approvals, and performance',
    theme: 'manager',
    navItems: [
      { label: 'Dashboard', path: '/manager' },
      { label: 'Team', path: '/manager/team' },
      { label: 'Approvals', path: '/manager/approvals' },
      { label: 'Performance', path: '/manager/performance' },
      { label: 'Requisitions', path: '/manager/requisitions' },
    ],
  },
  admin: {
    title: 'HR Administration',
    description: 'Full administrative access to all HR domains',
    theme: 'admin',
    navItems: [
      { label: 'Dashboard', path: '/admin' },
      { label: 'Workers', path: '/admin/workers' },
      { label: 'Organization', path: '/admin/organization' },
      { label: 'Payroll', path: '/admin/payroll' },
      { label: 'Compliance', path: '/admin/compliance' },
      { label: 'Country Policy', path: '/admin/country-policy' },
    ],
  },
};

/**
 * Portal-specific layout with contextual navigation and theming.
 */
export function PortalLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  const portalType = React.useMemo(() => {
    if (location.pathname.startsWith('/employee')) return 'employee';
    if (location.pathname.startsWith('/manager')) return 'manager';
    if (location.pathname.startsWith('/admin')) return 'admin';
    return null;
  }, [location.pathname]);

  const config = portalType ? portalConfigs[portalType] : null;

  if (!config) {
    return <>{children}</>;
  }

  const themeColors = {
    employee: 'border-l-blue-500',
    manager: 'border-l-green-500',
    admin: 'border-l-purple-500',
  };

  return (
    <div className="space-y-6">
      {/* Portal Header */}
      <div className={cn('border-l-4 bg-card rounded-lg p-6 shadow-sm', themeColors[config.theme])}>
        <h1 className="text-2xl font-bold">{config.title}</h1>
        <p className="text-muted-foreground mt-1">{config.description}</p>
      </div>

      {/* Portal Navigation */}
      <nav className="flex flex-wrap gap-2 border-b pb-2">
        {config.navItems.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
          return (
            <Link key={item.path} to={item.path}>
              <Button
                variant={isActive ? 'default' : 'ghost'}
                size="sm"
                className="relative"
              >
                {item.label}
                {item.badge !== undefined && item.badge > 0 && (
                  <Badge variant="destructive" className="ml-2 h-5 min-w-[20px] flex items-center justify-center p-0 text-xs">
                    {item.badge}
                  </Badge>
                )}
              </Button>
            </Link>
          );
        })}
      </nav>

      {/* Portal Content */}
      <div>{children}</div>
    </div>
  );
}
