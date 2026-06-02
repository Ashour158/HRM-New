import { Link } from 'react-router-dom';
import type { ComponentType } from 'react';
import { useApiQuery } from '@/hooks/use-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber } from '@/lib/utils';
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
  accent = '#10b981',
  isLoading,
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: ComponentType<{ className?: string }>;
  accent?: string;
  isLoading: boolean;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute left-0 top-0 h-1 w-full" style={{ backgroundColor: accent }} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="lumina-label">{label}</p>
            <p className="mt-2 font-headline text-4xl font-bold text-[#0b1c30]">
              {isLoading ? '-' : value}
            </p>
            <p className="mt-2 text-sm text-[#3c4a42]">{helper}</p>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-[#eff4ff]" style={{ color: accent }}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
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
      accent: '#006c49',
    },
    {
      label: 'Employee Records',
      path: '/admin/employees',
      icon: Users,
      description: 'Worker profiles become the source for self-service, payroll, and approvals.',
      accent: '#10b981',
    },
    {
      label: 'Leave & Attendance',
      path: '/admin/leave',
      icon: Umbrella,
      description: 'Policy-driven leave balances, approval queues, shifts, and attendance evidence.',
      accent: '#e29100',
    },
    {
      label: 'Payroll & Reward',
      path: '/admin/payroll',
      icon: FileText,
      description: 'Payroll operations consume attendance, leave, worker, and benefits data.',
      accent: '#855300',
    },
    {
      label: 'Governance',
      path: '/admin/compliance',
      icon: ShieldCheck,
      description: 'Country policy, compliance controls, allowed actions, and audit readiness.',
      accent: '#ba1a1a',
    },
    {
      label: 'Employee Mode Preview',
      path: '/employee',
      icon: UserCircle,
      description: 'Switch personas to verify the self-service experience without mixing it into admin operations.',
      accent: '#4648d4',
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
    <div className="min-h-full bg-[#f8f9ff]">
      <div className="lumina-canvas space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-headline text-4xl font-bold text-[#0b1c30]">Overview</h2>
            <p className="mt-2 text-lg text-[#3c4a42]">One HCM workspace for organization setup, employee self-service, workforce policy, payroll, and governance.</p>
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
            isLoading={isLoading}
          />
          <KpiCard
            label="Turnover Rate"
            value={`${data?.turnover ?? 0}%`}
            helper="Annualized movement"
            icon={TrendingDown}
            accent="#ba1a1a"
            isLoading={isLoading}
          />
          <KpiCard
            label="Open Positions"
            value={formatNumber(data?.openPositions)}
            helper="Recruiting and workforce demand"
            icon={Briefcase}
            accent="#e29100"
            isLoading={isLoading}
          />
          <KpiCard
            label="New Hires MTD"
            value={formatNumber(data?.newHiresThisMonth)}
            helper="Month-to-date onboarding volume"
            icon={UserPlus}
            accent="#4648d4"
            isLoading={isLoading}
          />
        </div>

        <Card className="relative overflow-hidden">
          <div className="absolute left-0 top-0 h-1 w-full bg-[#006c49]" />
          <CardHeader className="p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-xl">One HCM Operating Flow</CardTitle>
                <p className="mt-1 text-sm text-[#3c4a42]">
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
                  <div className="flex h-full min-h-[132px] flex-col rounded-lg border border-[#bbcabf]/70 bg-white p-4 transition-all group-hover:-translate-y-0.5 group-hover:border-[#10b981]/70 group-hover:bg-[#f8fbff]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#eff4ff]" style={{ color: item.accent }}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-[#6c7a71] transition-transform group-hover:translate-x-1 group-hover:text-[#006c49]" />
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-[#0b1c30]">{item.label}</h3>
                    <p className="mt-2 text-sm leading-5 text-[#3c4a42]">{item.description}</p>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <Card className="relative overflow-hidden">
            <div className="absolute left-0 top-0 h-1 w-full bg-[#e29100]" />
            <CardHeader className="p-5">
              <CardTitle className="flex items-center gap-2 text-xl">
                <AlertTriangle className="h-5 w-5 text-[#e29100]" />
                Alerts
              </CardTitle>
              <p className="text-sm text-[#3c4a42]">Items requiring HR operations attention.</p>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              {isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : data?.alerts && data.alerts.length > 0 ? (
                <div className="space-y-3">
                  {data.alerts.map((alert) => (
                    <div key={alert.id} className="flex items-start gap-3 rounded-lg border border-[#bbcabf]/70 bg-[#eff4ff] p-3">
                      <div
                        className={`mt-1 h-2.5 w-2.5 rounded-full ${
                          alert.severity === 'high'
                            ? 'bg-[#ba1a1a]'
                            : alert.severity === 'medium'
                            ? 'bg-[#e29100]'
                            : 'bg-[#10b981]'
                        }`}
                      />
                      <p className="text-sm leading-6 text-[#0b1c30]">{alert.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-[#bbcabf]/70 bg-[#eff4ff] p-4 text-sm text-[#3c4a42]">No active alerts</p>
              )}
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute left-0 top-0 h-1 w-full bg-[#10b981]" />
            <CardHeader className="p-5">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Activity className="h-5 w-5 text-[#006c49]" />
                Recent Activity
              </CardTitle>
              <p className="text-sm text-[#3c4a42]">Latest actions across the organization.</p>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              {isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : data?.recentActivity && data.recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {data.recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 rounded-lg border border-[#bbcabf]/60 bg-white p-3 hover:bg-[#eff4ff]">
                      <div className="mt-1 h-2.5 w-2.5 rounded-full bg-[#006c49]" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-6 text-[#0b1c30]">{activity.description}</p>
                        <p className="text-xs text-[#3c4a42]">{activity.timestamp}</p>
                      </div>
                      <Badge variant="outline" className="rounded-full border-[#bbcabf] bg-[#eff4ff] text-[#3c4a42]">
                        {activity.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-[#bbcabf]/70 bg-[#eff4ff] p-4 text-sm text-[#3c4a42]">No recent activity</p>
              )}
            </CardContent>
          </Card>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.path} to={item.path}>
                <Card className="relative h-full overflow-hidden transition-all hover:-translate-y-1 hover:border-[#10b981]/60 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
                  <div className="absolute left-0 top-0 h-1 w-full bg-[#10b981]" />
                  <CardContent className="flex h-full items-center gap-3 p-4">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#10b981]/10 text-[#006c49]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-semibold text-[#0b1c30]">{item.label}</span>
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
