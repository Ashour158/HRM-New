import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RePieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useApiQuery } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatNumber } from '@/lib/utils';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  ChevronRight,
  Clock,
  Clock3,
  CloudSun,
  Droplets,
  Eye,
  FileText,
  FolderOpen,
  Landmark,
  Layers3,
  Network,
  PieChart,
  Quote,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Umbrella,
  UserCircle,
  UserPlus,
  Users,
  Wind,
  Zap,
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

const CHART_COLORS = ['#818cf8', '#a78bfa', '#c084fc', '#2dd4bf', '#fbbf24', '#a5b4fc'];

const headcountTrend = [
  { month: 'Jan', headcount: 4480 },
  { month: 'Feb', headcount: 4525 },
  { month: 'Mar', headcount: 4598 },
  { month: 'Apr', headcount: 4662 },
  { month: 'May', headcount: 4744 },
  { month: 'Jun', headcount: 4820 },
];

const deptDistribution = [
  { name: 'Engineering', value: 1280 },
  { name: 'Sales', value: 920 },
  { name: 'Operations', value: 760 },
  { name: 'Marketing', value: 540 },
  { name: 'Finance', value: 480 },
  { name: 'People & Admin', value: 840 },
];

const hiresAttrition = [
  { month: 'Jan', hires: 64, exits: 38 },
  { month: 'Feb', hires: 71, exits: 42 },
  { month: 'Mar', hires: 83, exits: 35 },
  { month: 'Apr', hires: 77, exits: 51 },
  { month: 'May', hires: 88, exits: 44 },
  { month: 'Jun', hires: 92, exits: 39 },
];

const dailyQuotes = [
  "Great teams aren't built in a day — they're built every day.",
  'Small steps, taken daily, move mountains.',
  "People don't work for companies, they work for people. Lead well.",
  'Progress beats perfection. Ship the next good thing.',
  'Culture is what you do when no one is watching.',
  'Empower one person today and the ripple never stops.',
  'Clarity is kindness — say the helpful thing.',
  'Every record is a person. Every policy is a promise.',
  'Momentum loves consistency. Keep showing up.',
  'A calm leader builds a confident team.',
  'Make today 1% better than yesterday.',
  'Recognition costs nothing and changes everything.',
];

function getDailyQuote(seed: string): string {
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  let userSeed = 0;
  for (let i = 0; i < seed.length; i++) userSeed += seed.charCodeAt(i);
  return dailyQuotes[(dayOfYear + userSeed) % dailyQuotes.length];
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const alertDot: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-orange-500',
  low: 'bg-blue-500',
};
const alertBg: Record<string, string> = {
  high: 'bg-red-50/70 hover:bg-red-100/70',
  medium: 'bg-orange-50/70 hover:bg-orange-100/70',
  low: 'bg-blue-50/70 hover:bg-blue-100/70',
};
const alertTime: Record<string, string> = {
  high: 'Urgent',
  medium: 'Upcoming',
  low: 'Pending',
};

const moduleIcon: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-600',
  indigo: 'bg-indigo-100 text-indigo-600',
  violet: 'bg-violet-100 text-violet-600',
  purple: 'bg-purple-100 text-purple-600',
  teal: 'bg-teal-100 text-teal-600',
  rose: 'bg-rose-100 text-rose-600',
};

function KpiTile({
  label,
  helper,
  value,
  icon: Icon,
  gradient,
  shadow,
  accentText,
  badge,
  isLoading,
}: {
  label: string;
  helper: string;
  value: string | number;
  icon: LucideIcon;
  gradient: string;
  shadow: string;
  accentText: string;
  badge?: string;
  isLoading: boolean;
}) {
  return (
    <div
      className={cn(
        'group relative flex h-[180px] flex-col justify-between overflow-hidden rounded-[2rem] bg-gradient-to-br p-6 text-white shadow-lg fusion-hover',
        gradient,
        shadow,
      )}
    >
      <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/15 blur-2xl transition-transform duration-500 group-hover:scale-150" />
      <div className="relative z-10 flex items-start justify-between">
        <div className="rounded-2xl bg-white/20 p-3 backdrop-blur-sm">
          <Icon size={24} />
        </div>
        {badge ? (
          <div className="rounded-full bg-black/15 px-2.5 py-1 text-xs font-bold backdrop-blur-sm">{badge}</div>
        ) : (
          <ArrowRight size={20} className={accentText} />
        )}
      </div>
      <div className="relative z-10">
        <div className="mb-1 font-headline text-4xl font-extrabold leading-none">{isLoading ? '—' : value}</div>
        <div className={cn('text-sm font-medium', accentText)}>{helper}</div>
        <div className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-white/70">{label}</div>
      </div>
    </div>
  );
}

/**
 * HR Admin dashboard with org-wide metrics, analytics, activity, and alerts.
 */
export function AdminDashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useApiQuery<AdminDashboardData>(['admin-dashboard'], '/admin/dashboard');

  const firstName = user?.firstName?.trim() || 'there';
  const greeting = getGreeting();
  const dailyQuote = getDailyQuote(firstName);
  const periodLabel = new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const alerts = data?.alerts ?? [];
  const recentActivity = data?.recentActivity ?? [];

  const operatingFlow = [
    {
      label: 'People & Organization',
      path: '/admin/organization',
      icon: Network,
      description: 'Legal entities, departments, org units, positions, and manager lines.',
      color: 'blue',
    },
    {
      label: 'Employee Records',
      path: '/admin/employees',
      icon: FolderOpen,
      description: 'Worker profiles power self-service, payroll, and approvals.',
      color: 'indigo',
    },
    {
      label: 'Leave & Attendance',
      path: '/admin/leave',
      icon: Umbrella,
      description: 'Policy-driven leave balances, approval queues, shifts, and attendance.',
      color: 'violet',
    },
    {
      label: 'Payroll & Reward',
      path: '/admin/payroll',
      icon: FileText,
      description: 'Payroll operations consume attendance, leave, worker, and benefits data.',
      color: 'purple',
    },
    {
      label: 'Governance',
      path: '/admin/compliance',
      icon: ShieldCheck,
      description: 'Country policy, compliance controls, allowed actions, and audit readiness.',
      color: 'teal',
    },
    {
      label: 'Employee Mode Preview',
      path: '/employee',
      icon: Eye,
      description: 'Switch personas to verify the self-service experience.',
      color: 'rose',
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
    <div className="space-y-8">
      {/* Greeting header */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:justify-between">
        <div className="flex flex-col justify-center">
          <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-white/60 bg-white/60 py-1 pl-2 pr-3 text-xs font-bold text-slate-600 backdrop-blur-md">
            <span className="relative flex h-2.5 w-2.5">
              <span className="fusion-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            All systems operational · {periodLabel}
          </div>
          <h1 className="mb-3 font-headline text-4xl font-extrabold tracking-tight md:text-5xl">
            <span className="fusion-gradient-text">{greeting}, {firstName}</span>
          </h1>
          <p className="flex max-w-2xl items-start gap-2.5 text-base font-medium leading-relaxed text-slate-600 md:text-lg">
            <Quote size={20} className="mt-1 -scale-x-100 shrink-0 text-amber-400" fill="currentColor" />
            <span className="italic">{dailyQuote}</span>
          </p>
        </div>

        {/* Weather — decorative card */}
        <div className="relative w-full shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-300 via-purple-400 to-slate-400 p-6 text-white shadow-xl shadow-black/10 lg:w-[420px]">
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-violet-200/50 blur-2xl" aria-hidden="true" />
          <div className="relative z-10 flex items-stretch gap-6">
            <div className="flex min-w-0 flex-1 flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white/80">Today</p>
                  <p className="truncate text-lg font-bold leading-tight">London</p>
                </div>
                <CloudSun size={48} strokeWidth={1.75} className="fusion-float shrink-0" />
              </div>
              <div className="mt-3 flex items-end gap-2.5">
                <span className="text-5xl font-extrabold leading-none tracking-tighter">18°</span>
                <div className="pb-1">
                  <p className="text-sm font-bold leading-tight">Partly cloudy</p>
                  <p className="text-[11px] font-semibold text-white/80">H:21° · L:12°</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs font-semibold text-white/85">
                <span className="flex items-center gap-1.5">
                  <Droplets size={14} /> 64%
                </span>
                <span className="flex items-center gap-1.5">
                  <Wind size={14} /> 11 km/h
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Vivid bento KPI tiles */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Current active"
          helper="Total Headcount"
          value={formatNumber(data?.headcount)}
          icon={Users}
          gradient="from-indigo-400 to-violet-500"
          shadow="shadow-indigo-500/15"
          accentText="text-indigo-50/90"
          isLoading={isLoading}
        />
        <KpiTile
          label="Annualized"
          helper="Turnover Rate"
          value={`${data?.turnover ?? 0}%`}
          icon={TrendingDown}
          gradient="from-violet-400 to-purple-500"
          shadow="shadow-violet-500/15"
          accentText="text-violet-50/90"
          badge="-1.2%"
          isLoading={isLoading}
        />
        <KpiTile
          label="Demand"
          helper="Open Positions"
          value={formatNumber(data?.openPositions)}
          icon={Briefcase}
          gradient="from-teal-400 to-emerald-500"
          shadow="shadow-emerald-500/15"
          accentText="text-teal-50/90"
          isLoading={isLoading}
        />
        <KpiTile
          label="Volume"
          helper="New Hires MTD"
          value={formatNumber(data?.newHiresThisMonth)}
          icon={UserPlus}
          gradient="from-amber-400 to-orange-500"
          shadow="shadow-orange-500/15"
          accentText="text-amber-50/90"
          isLoading={isLoading}
        />
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Headcount growth — area */}
        <div className="flex flex-col rounded-[2rem] fusion-glass p-6 lg:col-span-2 lg:p-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <TrendingUp size={20} className="text-indigo-500" />
              Headcount Growth
            </h2>
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">Last 6 months</span>
          </div>
          <div className="-ml-2 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={headcountTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="fusionHeadcount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#a5b4fc" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} domain={['dataMin - 100', 'dataMax + 80']} width={48} />
                <ReTooltip contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', fontSize: 13 }} />
                <Area type="monotone" dataKey="headcount" stroke="#818cf8" strokeWidth={3} fill="url(#fusionHeadcount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* By department — donut */}
        <div className="flex flex-col rounded-[2rem] fusion-glass p-6 lg:p-8">
          <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
            <PieChart size={20} className="text-teal-500" />
            By Department
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie data={deptDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} stroke="none">
                  {deptDistribution.map((entry, i) => (
                    <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <ReTooltip contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', fontSize: 13 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hires vs attrition — bar */}
        <div className="flex flex-col rounded-[2rem] fusion-glass p-6 lg:col-span-3 lg:p-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <BarChart3 size={20} className="text-violet-500" />
              Hires vs Attrition
            </h2>
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-indigo-400" /> Hires
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-amber-300" /> Exits
              </span>
            </div>
          </div>
          <div className="-ml-2 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hiresAttrition} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={6}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={36} />
                <ReTooltip cursor={{ fill: 'rgba(99,102,241,0.06)' }} contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', fontSize: 13 }} />
                <Bar dataKey="hires" fill="#818cf8" radius={[8, 8, 0, 0]} maxBarSize={34} />
                <Bar dataKey="exits" fill="#fbbf24" radius={[8, 8, 0, 0]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Operating flow + alerts + activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Operating flow — glass */}
        <div className="flex flex-col rounded-[2rem] fusion-glass p-6 lg:col-span-2 lg:p-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <Zap size={20} className="text-indigo-500" />
              One HCM Operating Flow
            </h2>
            <Link to="/employee" className="flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
              Preview Employee Mode
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {operatingFlow.map((mod) => {
              const Icon = mod.icon;
              return (
                <Link
                  key={mod.path}
                  to={mod.path}
                  className="group flex cursor-pointer gap-4 rounded-2xl border border-white/60 bg-white/55 p-5 transition-all hover:bg-white/80 hover:shadow-md"
                >
                  <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', moduleIcon[mod.color])}>
                    <Icon size={22} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="mb-1 font-bold leading-tight text-slate-800">{mod.label}</h4>
                    <p className="text-sm font-medium leading-relaxed text-slate-500">{mod.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right column: alerts + activity */}
        <div className="flex flex-col gap-6">
          {/* Alerts — glass */}
          <div className="flex flex-col rounded-[2rem] fusion-glass p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <AlertTriangle className="text-orange-500" size={20} />
                Attention Required
              </h2>
              <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-700">{alerts.length}</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : alerts.length > 0 ? (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={cn('flex cursor-pointer items-start gap-3 rounded-xl border border-white/40 p-3 transition-colors', alertBg[alert.severity])}
                  >
                    <div className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', alertDot[alert.severity])} />
                    <div className="flex-1">
                      <p className="text-sm font-bold leading-snug text-slate-800">{alert.message}</p>
                      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {alertTime[alert.severity]}
                      </p>
                    </div>
                    <ChevronRight size={16} className="mt-1 shrink-0 text-slate-400" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-white/40 bg-white/55 p-4 text-sm font-medium text-slate-500">No active alerts</p>
            )}
          </div>

          {/* Recent activity — glass */}
          <div className="relative flex flex-1 flex-col overflow-hidden rounded-[2rem] fusion-glass p-6">
            <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 -translate-y-1/2 translate-x-1/2 rounded-full bg-indigo-400/15 blur-3xl" />
            <div className="relative z-10 mb-5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Clock className="text-indigo-500" size={20} />
                Recent Activity
              </h2>
            </div>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : recentActivity.length > 0 ? (
              <div className="relative z-10 space-y-5">
                {recentActivity.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-4 ring-white/60">
                      <Activity size={15} className="text-indigo-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="mb-1.5 text-sm font-semibold leading-snug text-slate-700">{item.description}</p>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                          {item.type}
                        </span>
                        <span className="text-xs font-medium text-slate-500">{item.timestamp}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="relative z-10 rounded-xl border border-white/40 bg-white/55 p-4 text-sm font-medium text-slate-500">No recent activity</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick links — glass tiles */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {quickLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="group flex items-center gap-3 rounded-2xl border border-white/60 bg-white/55 p-4 transition-all hover:-translate-y-0.5 hover:bg-white/80 hover:shadow-md fusion-hover"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-100 text-indigo-600">
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-sm font-semibold text-slate-800">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
