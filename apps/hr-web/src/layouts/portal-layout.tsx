import * as React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { resolvePortalSearchPath } from '@/lib/portal-search';
import { useAuth } from '@/hooks/use-auth';
import { useApiQuery } from '@/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  BarChart3,
  Bell,
  ChevronDown,
  ChevronUp,
  Clock3,
  FileText,
  HelpCircle,
  Home,
  LifeBuoy,
  LogOut,
  Search,
  Settings,
  Heart,
  Umbrella,
  UserCircle,
  UserRoundCheck,
  Users,
  TrendingUp,
  Network,
} from 'lucide-react';

interface PortalNavItem {
  label: string;
  path: string;
  badge?: number;
  systemOnly?: boolean;
}

interface PortalRailItem extends PortalNavItem {
  icon: React.ElementType;
}

type PortalType = 'employee' | 'manager' | 'admin';

interface PortalConfig {
  title: string;
  description: string;
  navItems: PortalNavItem[];
  theme: PortalType;
}

interface PortalNavGroup {
  label: string;
  path?: string;
  items?: PortalNavItem[];
  systemOnly?: boolean;
}

interface PlatformNotification {
  id: string;
  title: string;
  body: string;
  category: string;
  readAt?: string;
  createdAt: string;
}

const portalConfigs: Record<PortalType, PortalConfig> = {
  employee: {
    title: 'Employee Self-Service',
    description: 'Manage your profile, benefits, payslips, leave, and attendance',
    theme: 'employee',
    navItems: [
      { label: 'Dashboard', path: '/employee' },
      { label: 'Profile', path: '/employee/profile' },
      { label: 'Payroll', path: '/employee/payslip' },
      { label: 'Benefits', path: '/employee/benefits' },
      { label: 'Onboarding', path: '/employee/onboarding' },
      { label: 'Leave', path: '/employee/time-off' },
      { label: 'Performance', path: '/employee/performance' },
      { label: 'Services', path: '/employee/services' },
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
      { label: 'Admin Panel', path: '/admin/system-console', systemOnly: true },
      { label: 'Dashboard', path: '/employee' },
      { label: 'Profile', path: '/employee/profile' },
      { label: 'Payroll', path: '/employee/payslip' },
      { label: 'Benefits', path: '/employee/benefits' },
      { label: 'Onboarding', path: '/employee/onboarding' },
      { label: 'Leave', path: '/employee/time-off' },
      { label: 'Performance', path: '/employee/performance' },
      { label: 'Services', path: '/employee/services' },
    ],
  },
};

const employeeRailItems: PortalRailItem[] = [
  { label: 'Dashboard', path: '/employee', icon: Home },
  { label: 'Attendance', path: '/employee#attendance', icon: Clock3 },
  { label: 'Leave', path: '/employee/time-off', icon: Umbrella },
  { label: 'My Profile', path: '/employee/profile', icon: UserCircle },
  { label: 'Payslips', path: '/employee/payslip', icon: FileText },
  { label: 'Benefits', path: '/employee/benefits', icon: Heart },
  { label: 'Onboarding', path: '/employee/onboarding', icon: UserRoundCheck },
  { label: 'Performance', path: '/employee/performance', icon: TrendingUp },
  { label: 'Services', path: '/employee/services', icon: LifeBuoy },
];

const managerRailItems: PortalRailItem[] = [
  { label: 'Dashboard', path: '/manager', icon: Home },
  { label: 'Team', path: '/manager/team', icon: Users },
  { label: 'Approvals', path: '/manager/approvals', icon: BarChart3 },
];

const adminRailItems: PortalRailItem[] = [
  { label: 'Admin Panel', path: '/admin/system-console', icon: Network, systemOnly: true },
  { label: 'Dashboard', path: '/employee', icon: Home },
  { label: 'Attendance', path: '/employee#attendance', icon: Clock3 },
  { label: 'Leave', path: '/employee/time-off', icon: Umbrella },
  { label: 'My Profile', path: '/employee/profile', icon: UserCircle },
  { label: 'Payslips', path: '/employee/payslip', icon: FileText },
  { label: 'Benefits', path: '/employee/benefits', icon: Heart },
  { label: 'Onboarding', path: '/employee/onboarding', icon: UserRoundCheck },
  { label: 'Performance', path: '/employee/performance', icon: TrendingUp },
  { label: 'Services', path: '/employee/services', icon: LifeBuoy },
];

function portalRailItems(portalType: PortalType) {
  if (portalType === 'manager') return managerRailItems;
  if (portalType === 'admin') return adminRailItems;
  return employeeRailItems;
}

function portalNavGroups(portalType: PortalType): PortalNavGroup[] {
  if (portalType === 'admin') {
    return [
      {
        label: 'Admin Panel',
        systemOnly: true,
        items: [
          { label: 'Administrator Settings', path: '/admin/system-console' },
          { label: 'Policy Center', path: '/admin/system-console/policies' },
          { label: 'Access Governance', path: '/admin/system-console/access-governance' },
          { label: 'Tenant And Data Setup', path: '/admin/system-console/settings' },
          { label: 'Development Controls', path: '/admin/system-console#development-controls' },
          { label: 'Integration Controls', path: '/admin/system-console/integrations' },
          { label: 'Dead-Letter Events', path: '/admin/system-console/dead-letter-events' },
          { label: 'Audit Trail', path: '/admin/system-console/audit' },
          { label: 'Event Contracts', path: '/admin/system-console/event-contracts' },
        ],
      },
      {
        label: 'Self Service',
        items: [
          { label: 'Dashboard', path: '/employee' },
          { label: 'My Profile', path: '/employee/profile' },
          { label: 'HR Service Requests', path: '/employee/services' },
        ],
      },
      {
        label: 'Workforce',
        items: [
          { label: 'Check-in / Check-out', path: '/employee#attendance' },
          { label: 'Apply for Leave', path: '/employee/time-off' },
        ],
      },
      {
        label: 'Payroll & Reward',
        items: [
          { label: 'Payslips', path: '/employee/payslip' },
          { label: 'Benefits', path: '/employee/benefits' },
        ],
      },
      {
        label: 'Talent',
        items: [
          { label: 'Preboarding', path: '/employee/onboarding' },
          { label: 'Performance', path: '/employee/performance' },
        ],
      },
    ];
  }

  if (portalType === 'manager') {
    return [
      { label: 'Dashboard', path: '/manager' },
      {
        label: 'People & Organization',
        items: [
          { label: 'Team Directory', path: '/manager/team' },
          { label: 'Approvals', path: '/manager/approvals' },
        ],
      },
      { label: 'Talent', items: [{ label: 'Team Reviews', path: '/manager/approvals' }] },
    ];
  }

  return [
    { label: 'Dashboard', path: '/employee' },
    { label: 'People & Organization', items: [{ label: 'My Profile', path: '/employee/profile' }] },
    {
      label: 'Workforce',
      items: [
        { label: 'Check-in / Check-out', path: '/employee#attendance' },
        { label: 'Apply for Leave', path: '/employee/time-off' },
      ],
    },
    {
      label: 'Payroll & Reward',
      items: [
        { label: 'Payslips', path: '/employee/payslip' },
        { label: 'Benefits', path: '/employee/benefits' },
      ],
    },
    {
      label: 'Talent',
      items: [
        { label: 'Preboarding', path: '/employee/onboarding' },
        { label: 'Performance', path: '/employee/performance' },
      ],
    },
    {
      label: 'Services & Support',
      items: [
        { label: 'HR Service Requests', path: '/employee/services' },
        { label: 'Ask HR Support', path: '/employee/services' },
      ],
    },
  ];
}

function isPathActive(currentPath: string, currentHash: string, portalType: PortalType, path: string) {
  const [targetPath, targetHash] = path.split('#');
  const isRoot = targetPath === `/${portalType}`;
  const pathMatches = currentPath === targetPath || (!isRoot && currentPath.startsWith(`${targetPath}/`));
  return pathMatches && (!targetHash || currentHash === `#${targetHash}`);
}

function hasSystemAdminRole(roleNames: Set<string>) {
  return ['APP_ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN', 'HR_ADMIN'].some((roleName) => roleNames.has(roleName));
}

function WorkspaceShell({
  children,
  portalType,
  config,
}: {
  children: React.ReactNode;
  portalType: PortalType;
  config: PortalConfig;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [searchTerm, setSearchTerm] = React.useState('');
  const roleNames = React.useMemo(() => new Set((user?.roles ?? []).map((role) => role.name)), [user?.roles]);
  const canSeeAdminSettings = roleNames.has('HR_ADMIN') || roleNames.has('SUPER_ADMIN');
  const canSeeSystemConsole = hasSystemAdminRole(roleNames);
  const railItems = portalRailItems(portalType).filter((item) => !item.systemOnly || canSeeSystemConsole);
  const navGroups = portalNavGroups(portalType)
    .filter((group) => !group.systemOnly || canSeeSystemConsole)
    .map((group) => ({
      ...group,
      items: group.items?.filter((item) => !item.systemOnly || canSeeSystemConsole),
    }))
    .filter((group) => group.path || (group.items?.length ?? 0) > 0);
  const notificationPath = portalType === 'admin' ? '/notifications/hr-operations' : '/notifications/me';
  const { data: notificationsRaw } = useApiQuery<PlatformNotification[]>(
    ['platform-notifications', portalType],
    notificationPath,
    { enabled: Boolean(user), retry: false },
  );
  const notifications = notificationsRaw ?? [];
  const unreadNotifications = notifications.filter((notification) => !notification.readAt).length;
  const scrollWorkspace = React.useCallback((direction: -1 | 1) => {
    window.scrollBy({
      top: direction * Math.max(window.innerHeight * 0.8, 360),
      behavior: 'smooth',
    });
  }, []);
  const forwardSidebarWheel = React.useCallback((event: React.WheelEvent<HTMLElement>) => {
    window.scrollBy({ top: event.deltaY, behavior: 'auto' });
  }, []);
  const submitSearch = React.useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = searchTerm.trim();
    if (!trimmed) return;
    navigate(resolvePortalSearchPath(portalType, trimmed));
  }, [navigate, portalType, searchTerm]);
  const helpPath = '/employee/services';

  return (
    <div className="relative min-h-screen fusion-bg text-slate-900">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="fusion-blob" style={{ width: 420, height: 420, top: -90, left: '28%', background: 'radial-gradient(circle, #a5b4fc, #818cf8)' }} />
        <div className="fusion-blob fusion-blob-2" style={{ width: 360, height: 360, top: '22%', right: -70, background: 'radial-gradient(circle, #c4b5fd, #a78bfa)' }} />
        <div className="fusion-blob fusion-blob-3" style={{ width: 380, height: 380, bottom: -110, left: '18%', background: 'radial-gradient(circle, #99f6e4, #2dd4bf)' }} />
      </div>
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[260px] flex-col border-r border-white/40 fusion-glass py-6 md:flex" onWheel={forwardSidebarWheel}>
        <div className="px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 font-headline text-sm font-bold text-white shadow-lg shadow-indigo-500/25">
              EH
            </div>
            <div className="min-w-0">
              <h1 className="fusion-gradient-text font-headline text-2xl font-extrabold leading-none">Enterprise HR</h1>
              <p className="mt-1 text-sm text-slate-500">{config.title}</p>
            </div>
          </div>
          <Button asChild className="mt-6 w-full">
            <Link to="/employee/services">
              <span className="mr-2 text-lg leading-none">+</span>
              New Request
            </Link>
          </Button>
        </div>

        <nav className="mt-6 flex-1 space-y-1 overflow-y-auto px-2">
          {railItems.map((item) => {
            const Icon = item.icon;
            const [path, hash] = item.path.split('#');
            const isRoot = path === `/${portalType}`;
            const isActive = (isRoot ? location.pathname === path : location.pathname.startsWith(path))
              && (!hash || location.hash === `#${hash}`);
            return (
              <Link
                key={item.label}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 rounded-r-lg border-l-4 px-4 py-2.5 font-sans text-sm font-semibold transition-all duration-200 hover:translate-x-1 hover:bg-[#e0e7ff]',
                  isActive
                    ? 'border-[#4f46e5] bg-[#8b5cf6]/10 text-[#4f46e5]'
                    : 'border-transparent text-[#475569]',
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-1 border-t border-[#e2e8f0]/60 px-2 pt-4">
          {canSeeAdminSettings && portalType !== 'admin' ? (
            <Link className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-semibold text-[#475569] transition-all hover:translate-x-1 hover:bg-[#e0e7ff]" to="/admin/system-console">
              <Settings className="h-5 w-5" />
              Admin Panel
            </Link>
          ) : null}
          {portalType === 'admin' ? (
            <Link className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-semibold text-[#475569] transition-all hover:translate-x-1 hover:bg-[#e0e7ff]" to="/employee">
              <UserCircle className="h-5 w-5" />
              Employee Mode
            </Link>
          ) : null}
          <Link className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-semibold text-[#475569] transition-all hover:translate-x-1 hover:bg-[#e0e7ff]" to="/employee/services">
            <HelpCircle className="h-5 w-5" />
            Support
          </Link>
          <button className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-semibold text-[#475569] transition-all hover:translate-x-1 hover:bg-[#e0e7ff]" type="button" onClick={logout}>
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="relative z-10 flex min-h-screen min-w-0 max-w-full flex-col md:ml-[260px]">
        <header className="sticky top-0 z-30 shrink-0 border-b border-white/30 fusion-glass">
          <div className="flex h-14 items-center gap-3 px-4 md:px-6 lg:px-8">
            <div className="flex items-center gap-3 md:hidden">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 font-headline text-xs font-bold text-white shadow-md shadow-indigo-500/25">EH</div>
              <span className="fusion-gradient-text font-headline text-2xl font-extrabold">HRM Nexus</span>
            </div>

            <form className="relative hidden min-w-0 flex-1 lg:block xl:max-w-md" onSubmit={submitSearch}>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
              <input
                aria-label="Search modules, people, or settings"
                className="h-10 w-full rounded-full border-0 bg-[#f1f5f9] pl-10 pr-4 text-sm text-[#0f172a] outline-none transition-colors placeholder:text-[#94a3b8] focus:bg-white focus:ring-2 focus:ring-[#4f46e5]/20"
                placeholder="Search modules, people, or settings..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                type="search"
              />
            </form>

            <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadNotifications > 0 ? (
                      <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#e11d48] px-1 text-[10px] font-semibold text-white">
                        {Math.min(unreadNotifications, 9)}
                      </span>
                    ) : null}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 rounded-lg border-[#e2e8f0] bg-white p-2 shadow-[0_12px_32px_rgba(0,0,0,0.12)]">
                  <DropdownMenuLabel className="font-mono text-xs uppercase tracking-wider text-[#475569]">
                    Notifications
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notifications.length === 0 ? (
                    <DropdownMenuItem disabled className="rounded-md text-sm text-[#94a3b8]">
                      No notifications yet
                    </DropdownMenuItem>
                  ) : (
                    notifications.slice(0, 6).map((notification) => (
                      <DropdownMenuItem key={notification.id} className="items-start rounded-md p-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-[#0f172a]">{notification.title}</span>
                            {!notification.readAt ? <span className="h-2 w-2 shrink-0 rounded-full bg-[#4f46e5]" /> : null}
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#475569]">{notification.body}</p>
                          <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-[#94a3b8]">{notification.category}</p>
                        </div>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button asChild variant="ghost" size="icon" aria-label="Help">
                <Link to={helpPath}>
                  <HelpCircle className="h-5 w-5" />
                </Link>
              </Button>
              <Avatar className="h-9 w-9 border border-[#e2e8f0]">
                <AvatarImage src={user?.avatarUrl} alt={user?.firstName} />
                <AvatarFallback className="bg-[#8b5cf6] text-xs font-semibold text-white">
                  {user?.firstName?.charAt(0) ?? 'E'}{user?.lastName?.charAt(0) ?? 'H'}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
          <div className="flex h-11 max-w-full flex-nowrap items-center gap-2 overflow-x-auto border-t border-white/30 bg-white/40 px-4 text-sm md:px-6 lg:px-8">
            {navGroups.map((group) => {
              const groupItems = group.items ?? [];
              const isActive = group.path
                ? isPathActive(location.pathname, location.hash, portalType, group.path)
                : groupItems.some((item) => isPathActive(location.pathname, location.hash, portalType, item.path));

              if (group.path) {
                return (
                  <Link
                    key={group.label}
                    to={group.path}
                    className={cn(
                      'inline-flex h-9 shrink-0 items-center rounded-lg border px-3 text-sm font-semibold transition-colors',
                      isActive
                        ? 'border-[#4f46e5] bg-[#8b5cf6]/10 text-[#4f46e5]'
                        : 'border-transparent text-[#475569] hover:border-[#e2e8f0] hover:bg-[#eef2ff] hover:text-[#4f46e5]',
                    )}
                  >
                    {group.label}
                  </Link>
                );
              }

              return (
                <DropdownMenu key={group.label}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        'inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors',
                        isActive
                          ? 'border-[#4f46e5] bg-[#8b5cf6]/10 text-[#4f46e5]'
                          : 'border-transparent text-[#475569] hover:border-[#e2e8f0] hover:bg-[#eef2ff] hover:text-[#4f46e5]',
                      )}
                    >
                      {group.label}
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-60 rounded-lg border-[#e2e8f0] bg-white p-2 shadow-[0_12px_32px_rgba(0,0,0,0.12)]">
                    <DropdownMenuLabel className="font-mono text-xs uppercase tracking-wider text-[#475569]">
                      {group.label}
                    </DropdownMenuLabel>
                    {groupItems.map((item) => (
                      <DropdownMenuItem key={item.path} asChild className="rounded-md p-0">
                        <Link
                          to={item.path}
                          className={cn(
                            'flex w-full items-center rounded-md px-3 py-2 text-sm font-semibold',
                            isPathActive(location.pathname, location.hash, portalType, item.path)
                              ? 'bg-[#8b5cf6]/10 text-[#4f46e5]'
                              : 'text-[#0f172a] hover:bg-[#eef2ff]',
                          )}
                        >
                          {item.label}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })}
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <div className="fixed bottom-5 right-5 z-40 flex flex-col gap-2">
          <Button
            aria-label="Scroll up"
            className="h-10 w-10 rounded-full border border-[#e2e8f0] bg-white/95 p-0 text-[#4f46e5] shadow-[0_8px_24px_rgba(0,0,0,0.12)] hover:bg-[#eef2ff]"
            onClick={() => scrollWorkspace(-1)}
            title="Scroll up"
            type="button"
            variant="ghost"
          >
            <ChevronUp className="h-5 w-5" />
          </Button>
          <Button
            aria-label="Scroll down"
            className="h-10 w-10 rounded-full border border-[#e2e8f0] bg-white/95 p-0 text-[#4f46e5] shadow-[0_8px_24px_rgba(0,0,0,0.12)] hover:bg-[#eef2ff]"
            onClick={() => scrollWorkspace(1)}
            title="Scroll down"
            type="button"
            variant="ghost"
          >
            <ChevronDown className="h-5 w-5" />
          </Button>
        </div>

        <footer className="shrink-0 border-t border-white/30 fusion-glass px-4 py-8 text-sm text-slate-600 md:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1440px]">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-sm">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 font-headline text-sm font-bold text-white shadow-lg shadow-indigo-500/25">
                    EH
                  </div>
                  <div>
                    <p className="fusion-gradient-text font-headline text-lg font-extrabold leading-none">Enterprise HR</p>
                    <p className="mt-1 text-xs text-slate-500">Unified HCM workspace</p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-500">
                  One platform for HR administration, employee self-service, payroll, performance, and compliance.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-400">Company</p>
                  <ul className="mt-3 space-y-2">
                    <li><a className="transition-colors hover:text-indigo-600" href="#">About</a></li>
                    <li><a className="transition-colors hover:text-indigo-600" href="#">Careers</a></li>
                    <li><a className="transition-colors hover:text-indigo-600" href="#">Contact</a></li>
                  </ul>
                </div>
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-400">Legal</p>
                  <ul className="mt-3 space-y-2">
                    <li><a className="transition-colors hover:text-indigo-600" href="#">Privacy Policy</a></li>
                    <li><a className="transition-colors hover:text-indigo-600" href="#">Terms of Service</a></li>
                    <li><a className="transition-colors hover:text-indigo-600" href="#">Compliance</a></li>
                  </ul>
                </div>
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-400">Support</p>
                  <ul className="mt-3 space-y-2">
                    <li><a className="transition-colors hover:text-indigo-600" href="/employee/services">Help Center</a></li>
                    <li><a className="transition-colors hover:text-indigo-600" href="#">Security</a></li>
                    <li><a className="transition-colors hover:text-indigo-600" href="#">Status</a></li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/40 pt-6 text-xs text-slate-500 md:flex-row">
              <span className="font-mono font-semibold">&copy; {new Date().getFullYear()} HRM Nexus Enterprise. All rights reserved.</span>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <a className="underline-offset-4 hover:text-indigo-600 hover:underline" href="#">Privacy</a>
                <a className="underline-offset-4 hover:text-indigo-600 hover:underline" href="#">Terms</a>
                <a className="underline-offset-4 hover:text-indigo-600 hover:underline" href="#">Cookies</a>
                <a className="underline-offset-4 hover:text-indigo-600 hover:underline" href="#">Accessibility</a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

/**
 * Portal-specific layout with contextual navigation and theming.
 */
export function PortalLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  const portalType = React.useMemo<PortalType | null>(() => {
    if (location.pathname.startsWith('/employee')) return 'employee';
    if (location.pathname.startsWith('/manager')) return 'manager';
    if (location.pathname.startsWith('/admin')) return 'admin';
    return null;
  }, [location.pathname]);

  const config = portalType ? portalConfigs[portalType] : null;

  if (!portalType || !config) {
    return <>{children}</>;
  }

  return <WorkspaceShell portalType={portalType} config={config}>{children}</WorkspaceShell>;
}
