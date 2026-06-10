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
  Menu,
  Search,
  Settings,
  X,
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
      { label: 'Dashboard', path: '/admin' },
      { label: 'Employees', path: '/admin/employees' },
      { label: 'Organization', path: '/admin/organization' },
      { label: 'Attendance', path: '/admin/attendance' },
      { label: 'Leave', path: '/admin/leave-management' },
      { label: 'Payroll', path: '/admin/payroll' },
      { label: 'Performance', path: '/admin/performance/operations' },
      { label: 'Modules', path: '/admin/modules' },
      { label: 'Reports', path: '/admin/reports' },
      { label: 'System Console', path: '/admin/system-console', systemOnly: true },
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
  { label: 'Dashboard', path: '/admin', icon: Home },
  { label: 'Employees', path: '/admin/employees', icon: Users },
  { label: 'Organization', path: '/admin/organization', icon: Network },
  { label: 'Attendance', path: '/admin/attendance', icon: Clock3 },
  { label: 'Leave', path: '/admin/leave-management', icon: Umbrella },
  { label: 'Payroll', path: '/admin/payroll', icon: FileText },
  { label: 'Performance', path: '/admin/performance/operations', icon: TrendingUp },
  { label: 'Modules', path: '/admin/modules', icon: UserRoundCheck },
  { label: 'Reports', path: '/admin/reports', icon: BarChart3 },
  { label: 'System Console', path: '/admin/system-console', icon: Settings, systemOnly: true },
];

function portalRailItems(portalType: PortalType) {
  if (portalType === 'manager') return managerRailItems;
  if (portalType === 'admin') return adminRailItems;
  return employeeRailItems;
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
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  React.useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname, location.hash]);
  const roleNames = React.useMemo(() => new Set((user?.roles ?? []).map((role) => role.name)), [user?.roles]);
  const canSeeAdminSettings = roleNames.has('HR_ADMIN') || roleNames.has('SUPER_ADMIN');
  const canSeeSystemConsole = hasSystemAdminRole(roleNames);
  const railItems = portalRailItems(portalType).filter((item) => !item.systemOnly || canSeeSystemConsole);
  const notificationPath = portalType === 'admin' ? '/notifications/hr-operations' : '/notifications/me';
  const primaryActionPath = portalType === 'admin' ? '/admin/system-console' : '/employee/services';
  const primaryActionLabel = portalType === 'admin' ? 'Admin Panel' : 'New Request';
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
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[260px] flex-col border-r border-white/40 fusion-glass md:flex" onWheel={forwardSidebarWheel}>
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/30 px-5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 font-headline text-sm font-bold text-white shadow-lg shadow-indigo-500/25">
            EH
          </div>
          <div className="min-w-0">
            <p className="fusion-gradient-text font-headline text-lg font-extrabold leading-tight">Enterprise HR</p>
            <p className="truncate text-xs font-medium text-slate-500">{config.title}</p>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
          <Button asChild className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 font-bold text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30">
            <Link to={primaryActionPath}>
              <span className="mr-2 text-lg leading-none">+</span>
              {primaryActionLabel}
            </Link>
          </Button>

          <div>
            <p className="mb-3 px-2 text-xs font-bold uppercase tracking-wider text-slate-400">Core HCM</p>
            <nav className="space-y-1">
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
                      'flex items-center rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                      isActive
                        ? 'bg-white/80 text-indigo-700 shadow-sm'
                        : 'text-slate-600 hover:bg-white/50 hover:text-slate-900',
                    )}
                  >
                    <Icon className={cn('mr-3 h-[18px] w-[18px]', isActive ? 'text-indigo-600' : 'text-slate-400')} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div>
            <p className="mb-3 px-2 text-xs font-bold uppercase tracking-wider text-slate-400">System</p>
            <nav className="space-y-1">
              {canSeeAdminSettings && portalType !== 'admin' ? (
                <Link className="flex items-center rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-white/50 hover:text-slate-900" to="/admin/system-console">
                  <Settings className="mr-3 h-[18px] w-[18px] text-slate-400" />
                  Admin Panel
                </Link>
              ) : null}
              {portalType === 'admin' ? (
                <Link className="flex items-center rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-white/50 hover:text-slate-900" to="/employee">
                  <UserCircle className="mr-3 h-[18px] w-[18px] text-slate-400" />
                  Employee Mode
                </Link>
              ) : null}
              <Link className="flex items-center rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-white/50 hover:text-slate-900" to="/employee/services">
                <HelpCircle className="mr-3 h-[18px] w-[18px] text-slate-400" />
                Support
              </Link>
            </nav>
          </div>
        </div>

        <div className="shrink-0 border-t border-white/30 p-4">
          <div className="flex items-center gap-3 px-1">
            <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
              <AvatarImage src={user?.avatarUrl} alt={user?.firstName} />
              <AvatarFallback className="bg-gradient-to-tr from-indigo-400 to-violet-400 text-xs font-bold text-white">
                {user?.firstName?.charAt(0) ?? 'E'}{user?.lastName?.charAt(0) ?? 'H'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-800">
                {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Team Member'}
              </p>
              <p className="truncate text-xs font-medium text-slate-500">{config.title}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              aria-label="Sign out"
              title="Sign out"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/50 bg-white/40 text-slate-500 transition-colors hover:bg-white/70 hover:text-rose-600"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </aside>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-[280px] max-w-[85%] flex-col border-r border-white/40 fusion-glass">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/30 px-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 font-headline text-sm font-bold text-white shadow-lg shadow-indigo-500/25">
                  EH
                </div>
                <div className="min-w-0">
                  <p className="fusion-gradient-text font-headline text-lg font-extrabold leading-tight">Enterprise HR</p>
                  <p className="truncate text-xs font-medium text-slate-500">{config.title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation menu"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/50 bg-white/40 text-slate-500 transition-colors hover:bg-white/70 hover:text-slate-900"
              >
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
              <Button asChild className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 font-bold text-white shadow-lg shadow-indigo-500/25">
                <Link to={primaryActionPath}>
                  <span className="mr-2 text-lg leading-none">+</span>
                  {primaryActionLabel}
                </Link>
              </Button>

              <div>
                <p className="mb-3 px-2 text-xs font-bold uppercase tracking-wider text-slate-400">Core HCM</p>
                <nav className="space-y-1">
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
                          'flex items-center rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                          isActive
                            ? 'bg-white/80 text-indigo-700 shadow-sm'
                            : 'text-slate-600 hover:bg-white/50 hover:text-slate-900',
                        )}
                      >
                        <Icon className={cn('mr-3 h-[18px] w-[18px]', isActive ? 'text-indigo-600' : 'text-slate-400')} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>

              <div>
                <p className="mb-3 px-2 text-xs font-bold uppercase tracking-wider text-slate-400">System</p>
                <nav className="space-y-1">
                  {canSeeAdminSettings && portalType !== 'admin' ? (
                    <Link className="flex items-center rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-white/50 hover:text-slate-900" to="/admin/system-console">
                      <Settings className="mr-3 h-[18px] w-[18px] text-slate-400" />
                      Admin Panel
                    </Link>
                  ) : null}
                  {portalType === 'admin' ? (
                    <Link className="flex items-center rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-white/50 hover:text-slate-900" to="/employee">
                      <UserCircle className="mr-3 h-[18px] w-[18px] text-slate-400" />
                      Employee Mode
                    </Link>
                  ) : null}
                  <Link className="flex items-center rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-white/50 hover:text-slate-900" to="/employee/services">
                    <HelpCircle className="mr-3 h-[18px] w-[18px] text-slate-400" />
                    Support
                  </Link>
                </nav>
              </div>
            </div>

            <div className="shrink-0 border-t border-white/30 p-4">
              <div className="flex items-center gap-3 px-1">
                <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                  <AvatarImage src={user?.avatarUrl} alt={user?.firstName} />
                  <AvatarFallback className="bg-gradient-to-tr from-indigo-400 to-violet-400 text-xs font-bold text-white">
                    {user?.firstName?.charAt(0) ?? 'E'}{user?.lastName?.charAt(0) ?? 'H'}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800">
                    {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Team Member'}
                  </p>
                  <p className="truncate text-xs font-medium text-slate-500">{config.title}</p>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  aria-label="Sign out"
                  title="Sign out"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/50 bg-white/40 text-slate-500 transition-colors hover:bg-white/70 hover:text-rose-600"
                >
                  <LogOut className="h-[18px] w-[18px]" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      <div className="relative z-10 flex min-h-screen min-w-0 max-w-full flex-col md:ml-[260px]">
        <header className="sticky top-0 z-30 shrink-0 border-b border-white/30 fusion-glass">
          <div className="flex h-14 items-center gap-3 px-4 md:px-6 lg:px-8">
            <div className="flex items-center gap-2.5 md:hidden">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation menu"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/50 bg-white/40 text-slate-600 transition-colors hover:bg-white/70 hover:text-indigo-600"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 font-headline text-xs font-bold text-white shadow-md shadow-indigo-500/25">EH</div>
              <span className="fusion-gradient-text font-headline text-xl font-extrabold">Enterprise HR</span>
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
              <Link to="/employee/profile" aria-label="View your profile" title="View your profile" className="group ml-1 flex items-center gap-2.5">
                <Avatar className="h-9 w-9 border-2 border-white shadow-sm transition-transform group-hover:scale-105">
                  <AvatarImage src={user?.avatarUrl} alt={user?.firstName} />
                  <AvatarFallback className="bg-gradient-to-tr from-indigo-400 to-violet-400 text-xs font-bold text-white">
                    {user?.firstName?.charAt(0) ?? 'E'}{user?.lastName?.charAt(0) ?? 'H'}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden flex-col leading-tight xl:flex">
                  <span className="text-sm font-bold text-slate-700 transition-colors group-hover:text-indigo-600">
                    {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Team Member'}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400">{config.title}</span>
                </span>
              </Link>
            </div>
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
              <span className="font-mono font-semibold">&copy; {new Date().getFullYear()} Enterprise HR. All rights reserved.</span>
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
