import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Clock3,
  FileText,
  Home,
  Settings,
  Heart,
  Umbrella,
  Users,
} from 'lucide-react';

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
    description: 'Manage your profile, benefits, payslips, leave, and attendance',
    theme: 'employee',
    navItems: [
      { label: 'Dashboard', path: '/employee' },
      { label: 'Profile', path: '/employee/profile' },
      { label: 'Payroll', path: '/employee/payslip' },
      { label: 'Benefits', path: '/employee/benefits' },
      { label: 'Leave', path: '/employee/time-off' },
    ],
  },
  manager: {
    title: 'Manager Self-Service',
    description: 'Manage your team and approvals',
    theme: 'manager',
    navItems: [
      { label: 'Dashboard', path: '/manager' },
      { label: 'Team', path: '/manager/team' },
      { label: 'Approvals', path: '/manager/approvals' },
    ],
  },
  admin: {
    title: 'HR Administration',
    description: 'Full administrative access to all HR domains',
    theme: 'admin',
    navItems: [
      { label: 'Dashboard', path: '/admin' },
      { label: 'Employees', path: '/admin/employees' },
      { label: 'Organization', path: '/admin/organization' },
      { label: 'Attendance', path: '/admin/attendance' },
      { label: 'Payroll', path: '/admin/payroll' },
      { label: 'Performance', path: '/admin/performance' },
      { label: 'Compliance', path: '/admin/compliance' },
      { label: 'Country Policy', path: '/admin/country-policy' },
      { label: 'Settings', path: '/admin/settings' },
    ],
  },
};

const employeeRailItems = [
  { label: 'Home', path: '/employee', icon: Home },
  { label: 'Attendance', path: '/employee#attendance', icon: Clock3 },
  { label: 'Leave', path: '/employee/time-off', icon: Umbrella },
  { label: 'Profile', path: '/employee/profile', icon: Users },
  { label: 'Payroll', path: '/employee/payslip', icon: FileText },
  { label: 'Benefits', path: '/employee/benefits', icon: Heart },
];

function EmployeeWorkspaceShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user } = useAuth();
  const roleNames = React.useMemo(() => new Set((user?.roles ?? []).map((role) => role.name)), [user?.roles]);
  const canSeeTeam = roleNames.has('MANAGER') || roleNames.has('HR_ADMIN') || roleNames.has('SUPER_ADMIN');
  const canSeeOrganization = roleNames.has('HR_ADMIN') || roleNames.has('SUPER_ADMIN');
  const canSeeAdminSettings = roleNames.has('HR_ADMIN') || roleNames.has('SUPER_ADMIN');

  return (
    <div className="min-h-screen bg-[#e9eef5] text-slate-950">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[68px] shrink-0 flex-col bg-[#17275c] text-white md:flex">
          <div className="flex h-14 items-center justify-center border-b border-white/10">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-[#0b8cff] text-[11px] font-bold">H</div>
          </div>
          <nav className="flex-1 space-y-2 p-2">
            {employeeRailItems.map((item) => {
              const Icon = item.icon;
              const [path, hash] = item.path.split('#');
              const isActive = location.pathname === path
                && (!hash || location.hash === `#${hash}`);
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  className={cn(
                    'group flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[10px] font-semibold text-white/80 transition-colors',
                    isActive ? 'bg-[#0b8cff] text-white' : 'hover:bg-white/10 hover:text-white',
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="max-w-[56px] truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          {canSeeAdminSettings ? (
            <div className="space-y-2 p-2">
              <Link className="flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[10px] font-semibold text-white/80 hover:bg-white/10" to="/admin/settings">
                <Settings className="h-5 w-5" />
                <span>Settings</span>
              </Link>
            </div>
          ) : null}
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-[#26345f] bg-[#2b3969] text-white">
            <div className="flex h-14 items-center gap-5 px-4 lg:px-5">
              <nav className="flex h-full items-center gap-1 text-sm font-semibold">
                {[
                  { label: 'My Space', path: '/employee', visible: true },
                  { label: 'Team', path: '/manager/team', visible: canSeeTeam },
                  { label: 'Organization', path: '/admin/organization', visible: canSeeOrganization },
                ].filter((item) => item.visible).map((item) => (
                  <Link
                    key={item.label}
                    to={item.path}
                    className={cn(
                      'flex h-full items-center border-b-2 px-4 transition-colors',
                      location.pathname.startsWith(item.path) ? 'border-[#1f9cff] bg-white/5' : 'border-transparent hover:bg-white/5',
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="ml-auto flex items-center gap-3">
                <Avatar className="h-8 w-8 border border-white/30">
                  <AvatarImage src={user?.avatarUrl} alt={user?.firstName} />
                  <AvatarFallback className="bg-[#f59e0b] text-xs text-white">
                    {user?.firstName?.charAt(0) ?? 'E'}{user?.lastName?.charAt(0) ?? 'M'}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
            <div className="flex h-10 items-center gap-6 overflow-x-auto bg-white px-5 text-sm text-slate-950">
              {[
                { label: 'Overview', path: '/employee' },
                { label: 'Profile', path: '/employee/profile' },
                { label: 'Leave', path: '/employee/time-off' },
                { label: 'Payroll', path: '/employee/payslip' },
                { label: 'Benefits', path: '/employee/benefits' },
              ].map((item) => (
                <Link
                  key={item.label}
                  to={item.path}
                  className={cn(
                    'flex h-full shrink-0 items-center border-b-2 px-2 font-medium',
                    location.pathname === item.path ? 'border-[#0b8cff] text-slate-950' : 'border-transparent text-slate-700 hover:text-slate-950',
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </header>

          <main>{children}</main>
        </div>
      </div>
    </div>
  );
}

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

  if (config.theme === 'employee') {
    return <EmployeeWorkspaceShell>{children}</EmployeeWorkspaceShell>;
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
          const isPortalRoot = item.path === `/${portalType}`;
          const isActive = location.pathname === item.path || (!isPortalRoot && location.pathname.startsWith(`${item.path}/`));
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
