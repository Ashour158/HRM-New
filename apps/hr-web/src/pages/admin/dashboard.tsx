import { Link } from 'react-router-dom';
import type { ComponentType } from 'react';
import { useApiQuery } from '@/hooks/use-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatNumber } from '@/lib/utils';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Building2,
  Clock3,
  FileText,
  Landmark,
  Layers3,
  ShieldCheck,
  TrendingDown,
  Umbrella,
  UserCircle,
  UserPlus,
  Users,
} from 'lucide-react';

interface AdminDashboardData {
  headcount: number;
  turnover: number;
  openPositions: number;
  newHiresThisMonth: number;
  terminationsThisMonth: number;
  recentActivity: Array<{
    id: string;
    description: string;
    timestamp: string;
    type: string;
  }>;
  alerts: Array<{
    id: string;
    severity: 'low' | 'medium' | 'high';
    message: string;
  }>;
}

function KpiCard({
  label,
  value,
  helper,
  icon: Icon,
  gradient = 'from-violet-500 to-purple-600',
  shadow = 'shadow-violet-500/25',
  isLoading,
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: ComponentType<{ className?: string }>;
  gradient?: string;
  shadow?: string;
  isLoading: boolean;
}) {
  return (
    <div className={cn('relative overflow-hidden rounded-[2rem] bg-gradient-to-br p-6 text-white shadow-lg', gradient, shadow)}>
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
      <div className="relative flex items-center justify-between">
        <span className="text-sm font-semibold text-white/80">{label}</span>
        <Icon className="h-5 w-5 text-white/70" />
      </div>
      <p className="relative mt-5 font-headline text-4xl font-extrabold leading-none">{isLoading ? '-' : value}</p>
      <p className="relative mt-2 text-xs font-medium text-white/70">{helper}</p>
    </div>
  );
}

/**
 * HR Admin dashboard with org-wide metrics, activity, and alerts.
 */
export function AdminDashboard() {
  const { data, isLoading } = useApiQuery<AdminDashboardData>(
    ['admin-dashboard'],
    '/admin/dashboard'
  );

  const operatingFlow = [
    {
      label: 'People & Organization',
      path: '/admin/organization',
      icon: Building2,
      description: 'Legal entities, departments, org units, positions, and manager lines.',
      accent: '#4f46e5',
    },
    {
      label: 'Employee Records',
      path: '/admin/employees',
      icon: Users,
      description: 'Worker profiles become the source for self-service, payroll, and approvals.',
      accent: '#8b5cf6',
    },
    {
      label: 'Leave & Attendance',
      path: '/admin/leave',
      icon: Umbrella,
      description: 'Policy-driven leave balances, approval queues, shifts, and attendance evidence.',
      accent: '#f59e0b',
    },
    {
      label: 'Payroll & Reward',
      path: '/admin/payroll',
      icon: FileText,
      description: 'Payroll operations consume attendance, leave, worker, and benefits data.',
      accent: '#b45309',
    },
    {
      label: 'Governance',
      path: '/admin/compliance',
      icon: ShieldCheck,
      description: 'Country policy, compliance controls, allowed actions, and audit readiness.',
      accent: '#e11d48',
    },
    {
      label: 'Employee Mode Preview',
      path: '/employee',
      icon: UserCircle,
      description: 'Switch personas to verify the self-service experience without mixing it into admin operations.',
      accent: '#6366f1',
    },
  ];

  const quickLinks = [
    { label: 'Module Workbench', path: '/admin/modules', icon: Layers3 },
    { label: 'Organization', path: '/admin/organization', icon: Building2 },
    { label: 'Employees', path: '/admin/employees', icon: Users },
    { label: 'Service Delivery', path: '/admin/modules/service-delivery/operations', icon: UserCircle },
    { label: 'Attendance', path: '/admin/attendance', icon: Clock3 },
    { label: 'Leave', path: '/admin/leave', icon: Umbrella },
    { label: 'Payroll', path: '/admin/payroll', icon: Activity },
    { label: 'Country Policy', path: '/admin/country-policy', icon: Landmark },
  ];

  return (
    <div className="min-h-full fusion-bg">
      <div className="lumina-canvas relative z-10 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-headline text-4xl font-extrabold tracking-tight text-slate-900">
              Admin <span className="fusion-gradient-text">Overview</span>
            </h2>
            <p className="mt-2 text-lg text-[#475569]">One HCM workspace for organization setup, employee self-service, workforce policy, payroll, and governance.</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/admin/modules">
              <Layers3 className="mr-2 h-4 w-4" />
              Module Catalog
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Total Headcount"
            value={formatNumber(data?.headcount)}
            helper="Current active workforce"
            icon={Users}
            gradient="from-indigo-500 to-indigo-600"
            shadow="shadow-indigo-500/25"
            isLoading={isLoading}
          />
          <KpiCard
            label="Turnover Rate"
            value={`${data?.turnover ?? 0}%`}
            helper="Annualized movement"
            icon={TrendingDown}
            gradient="from-rose-500 to-pink-600"
            shadow="shadow-rose-500/25"
            isLoading={isLoading}
          />
          <KpiCard
            label="Open Positions"
            value={formatNumber(data?.openPositions)}
            helper="Recruiting and workforce demand"
            icon={Briefcase}
            gradient="from-amber-400 to-orange-500"
            shadow="shadow-amber-500/25"
            isLoading={isLoading}
          />
          <KpiCard
            label="New Hires MTD"
            value={formatNumber(data?.newHiresThisMonth)}
            helper="Month-to-date onboarding volume"
            icon={UserPlus}
            gradient="from-teal-500 to-emerald-600"
            shadow="shadow-teal-500/25"
            isLoading={isLoading}
          />
        </div>

        <Card className="relative overflow-hidden">
          <div className="absolute left-0 top-0 h-1 w-full bg-[#4f46e5]" />
          <CardHeader className="p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-xl">One HCM Operating Flow</CardTitle>
                <p className="mt-1 text-sm text-[#475569]">
                  Configure the enterprise once, then let the same data power employee actions, manager approvals, payroll, and policy controls.
                </p>
              </div>
              <Button asChild size="sm" variant="secondary">
                <Link to="/employee">
                  Preview Employee Mode
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 p-5 pt-0 md:grid-cols-2 xl:grid-cols-3">
            {operatingFlow.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.path} to={item.path} className="group">
                  <div className="flex h-full min-h-[132px] flex-col rounded-lg border border-[#e2e8f0]/70 bg-white p-4 transition-all group-hover:-translate-y-0.5 group-hover:border-[#8b5cf6]/70 group-hover:bg-[#f6f7fb]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#eef2ff]" style={{ color: item.accent }}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-[#94a3b8] transition-transform group-hover:translate-x-1 group-hover:text-[#4f46e5]" />
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-[#0f172a]">{item.label}</h3>
                    <p className="mt-2 text-sm leading-5 text-[#475569]">{item.description}</p>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <Card className="relative overflow-hidden">
            <div className="absolute left-0 top-0 h-1 w-full bg-[#f59e0b]" />
            <CardHeader className="p-5">
              <CardTitle className="flex items-center gap-2 text-xl">
                <AlertTriangle className="h-5 w-5 text-[#f59e0b]" />
                Alerts
              </CardTitle>
              <p className="text-sm text-[#475569]">Items requiring HR operations attention.</p>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              {isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : data?.alerts && data.alerts.length > 0 ? (
                <div className="space-y-3">
                  {data.alerts.map((alert) => (
                    <div key={alert.id} className="flex items-start gap-3 rounded-lg border border-[#e2e8f0]/70 bg-[#eef2ff] p-3">
                      <div
                        className={`mt-1 h-2.5 w-2.5 rounded-full ${
                          alert.severity === 'high'
                            ? 'bg-[#e11d48]'
                            : alert.severity === 'medium'
                            ? 'bg-[#f59e0b]'
                            : 'bg-[#8b5cf6]'
                        }`}
                      />
                      <p className="text-sm leading-6 text-[#0f172a]">{alert.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-[#e2e8f0]/70 bg-[#eef2ff] p-4 text-sm text-[#475569]">No active alerts</p>
              )}
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute left-0 top-0 h-1 w-full bg-[#8b5cf6]" />
            <CardHeader className="p-5">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Activity className="h-5 w-5 text-[#4f46e5]" />
                Recent Activity
              </CardTitle>
              <p className="text-sm text-[#475569]">Latest actions across the organization.</p>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              {isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : data?.recentActivity && data.recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {data.recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 rounded-lg border border-[#e2e8f0]/60 bg-white p-3 hover:bg-[#eef2ff]">
                      <div className="mt-1 h-2.5 w-2.5 rounded-full bg-[#4f46e5]" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-6 text-[#0f172a]">{activity.description}</p>
                        <p className="text-xs text-[#475569]">{activity.timestamp}</p>
                      </div>
                      <Badge variant="outline" className="rounded-full border-[#e2e8f0] bg-[#eef2ff] text-[#475569]">
                        {activity.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-[#e2e8f0]/70 bg-[#eef2ff] p-4 text-sm text-[#475569]">No recent activity</p>
              )}
            </CardContent>
          </Card>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.path} to={item.path}>
                <Card className="relative h-full overflow-hidden transition-all hover:-translate-y-1 hover:border-[#8b5cf6]/60 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
                  <div className="absolute left-0 top-0 h-1 w-full bg-[#8b5cf6]" />
                  <CardContent className="flex h-full items-center gap-3 p-4">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#8b5cf6]/10 text-[#4f46e5]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-semibold text-[#0f172a]">{item.label}</span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </section>
      </div>
    </div>
  );
}
