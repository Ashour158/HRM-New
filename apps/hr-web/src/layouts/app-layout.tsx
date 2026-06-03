import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import { useUIStore } from '@/stores/ui-store';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Menu,
  X,
  Home,
  Users,
  Bell,
  ChevronDown,
  LogOut,
  Building2,
  Shield,
  UserCircle,
} from 'lucide-react';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles?: string[];
}

const navItems: NavItem[] = [
  { label: 'Employee Portal', path: '/employee', icon: <UserCircle className="h-5 w-5" />, roles: ['EMPLOYEE'] },
  { label: 'Manager Hub', path: '/manager', icon: <Users className="h-5 w-5" />, roles: ['MANAGER'] },
  { label: 'HR Admin', path: '/admin', icon: <Shield className="h-5 w-5" />, roles: ['HR_ADMIN'] },
];

/**
 * Main application layout with sidebar, header, and responsive design.
 */
export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { tenantName, tenants, setTenantId } = useTenant();
  const { sidebarOpen, toggleSidebar, notifications } = useUIStore();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (location.pathname.startsWith('/employee') || location.pathname.startsWith('/manager') || location.pathname.startsWith('/admin')) {
    return <div className="min-h-screen bg-[#e9eef5]">{children}</div>;
  }

  const accessibleNavItems = navItems.filter((item) => {
    if (!item.roles) return true;
    return user?.roles.some((r) => item.roles?.includes(r.name));
  });

  const renderNavItem = (item: NavItem) => {
    const isActive = location.pathname.startsWith(item.path);
    return (
      <Link
        key={item.path}
        to={item.path}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )}
        onClick={() => setMobileOpen(false)}
      >
        {item.icon}
        <span className={cn('transition-opacity', sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden')}>{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col border-r bg-card transition-all duration-300',
          sidebarOpen ? 'w-64' : 'w-16'
        )}
      >
        <div className="flex h-16 items-center border-b px-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <Building2 className="h-6 w-6 text-primary" />
            {sidebarOpen && <span className="truncate">HR/HCM</span>}
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          <Link
            to="/"
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              location.pathname === '/'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Home className="h-5 w-5" />
            {sidebarOpen && <span>Home</span>}
          </Link>
          {accessibleNavItems.map(renderNavItem)}
        </nav>
        <div className="border-t p-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <Menu className="h-5 w-5" />
            {sidebarOpen && <span className="ml-2">Collapse</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-card border-r flex flex-col">
            <div className="flex h-16 items-center justify-between border-b px-4">
              <Link to="/" className="flex items-center gap-2 font-bold text-lg">
                <Building2 className="h-6 w-6 text-primary" />
                <span>HR/HCM</span>
              </Link>
              <Button variant="ghost" size="sm" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex-1 space-y-1 p-3">
              <Link
                to="/"
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                  location.pathname === '/' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                )}
                onClick={() => setMobileOpen(false)}
              >
                <Home className="h-5 w-5" />
                Home
              </Link>
              {accessibleNavItems.map(renderNavItem)}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur px-4 lg:px-6">
          <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1" />

          {/* Tenant Selector */}
          {tenants.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">{tenantName}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Select Organization</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {tenants.map((t) => (
                  <DropdownMenuItem key={t.id} onClick={() => setTenantId(t.id)}>
                    {t.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="relative" aria-label="Notifications">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <DropdownMenuItem disabled>No notifications</DropdownMenuItem>
              ) : (
                notifications.slice(0, 5).map((n) => (
                  <DropdownMenuItem key={n.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{n.title}</span>
                      <span className="text-xs text-muted-foreground">{n.message}</span>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.avatarUrl} alt={user?.firstName} />
                  <AvatarFallback>{user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline text-sm font-medium">{user?.firstName} {user?.lastName}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/employee/profile">Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/admin/system-console">Admin Panel</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
