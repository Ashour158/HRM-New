import React, { useState, useEffect } from "react";
import {
  Users,
  TrendingDown,
  Briefcase,
  UserPlus,
  Network,
  FolderOpen,
  Calendar,
  Wallet,
  ShieldCheck,
  Eye,
  AlertTriangle,
  Clock,
  ArrowRight,
  Search,
  BellRing,
  Menu,
  ChevronRight,
  LayoutGrid,
  CheckCircle2,
  FileText,
  Settings,
  Zap,
  HelpCircle,
  Quote,
  TrendingUp,
  BarChart3,
  PieChart,
  CloudSun,
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Droplets,
  Wind,
  LogIn,
  LogOut,
} from "lucide-react";
import {
  AreaChart as ReAreaChart,
  Area,
  BarChart as ReBarChart,
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
} from "recharts";
import "./_group.css";
import companyLogo from "../../../assets/company-logo.png";

const currentUser = "Jane";

const companyBranding = {
  name: "Northwind Group",
  logo: companyLogo,
};

const weatherThemes = {
  sunny: {
    label: "Sunny",
    Icon: Sun,
    gradient: "from-amber-300 via-orange-400 to-orange-500",
    glow: "bg-amber-300/50",
  },
  "partly-cloudy": {
    label: "Partly cloudy",
    Icon: CloudSun,
    gradient: "from-violet-300 via-purple-400 to-slate-400",
    glow: "bg-violet-200/50",
  },
  cloudy: {
    label: "Cloudy",
    Icon: Cloud,
    gradient: "from-slate-400 via-slate-500 to-slate-600",
    glow: "bg-slate-200/50",
  },
  rainy: {
    label: "Rainy",
    Icon: CloudRain,
    gradient: "from-slate-500 via-slate-600 to-zinc-700",
    glow: "bg-slate-300/50",
  },
  stormy: {
    label: "Stormy",
    Icon: CloudLightning,
    gradient: "from-zinc-700 via-slate-800 to-neutral-900",
    glow: "bg-zinc-400/40",
  },
  snowy: {
    label: "Snowy",
    Icon: CloudSnow,
    gradient: "from-violet-300 via-purple-400 to-slate-500",
    glow: "bg-violet-200/50",
  },
} as const;

type WeatherCondition = keyof typeof weatherThemes;

const dailyWeather: {
  city: string;
  tempC: number;
  hiC: number;
  loC: number;
  humidity: number;
  wind: number;
  condition: WeatherCondition;
  forecast: { day: string; condition: WeatherCondition; tempC: number }[];
} = {
  city: "London",
  tempC: 18,
  hiC: 21,
  loC: 12,
  humidity: 64,
  wind: 11,
  condition: "partly-cloudy",
  forecast: [
    { day: "Thu", condition: "sunny", tempC: 22 },
    { day: "Fri", condition: "rainy", tempC: 17 },
    { day: "Sat", condition: "cloudy", tempC: 19 },
  ],
};

const dailyQuotes = [
  "Great teams aren't built in a day — they're built every day.",
  "Small steps, taken daily, move mountains.",
  "People don't work for companies, they work for people. Lead well.",
  "Progress beats perfection. Ship the next good thing.",
  "Culture is what you do when no one is watching.",
  "Empower one person today and the ripple never stops.",
  "The best time to support your team was yesterday. The second best is now.",
  "Clarity is kindness — say the helpful thing.",
  "Every record is a person. Every policy is a promise.",
  "Momentum loves consistency. Keep showing up.",
  "Hire for heart, train for skill, lead with trust.",
  "A calm leader builds a confident team.",
  "Make today 1% better than yesterday.",
  "Recognition costs nothing and changes everything.",
  "Build the workplace you wish you had.",
];

function getDailyQuote(user: string): string {
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000,
  );
  let userSeed = 0;
  for (let i = 0; i < user.length; i++) userSeed += user.charCodeAt(i);
  const index = (dayOfYear + userSeed) % dailyQuotes.length;
  return dailyQuotes[index];
}

const moduleIcon: Record<string, string> = {
  blue: "bg-blue-100 text-blue-600",
  indigo: "bg-indigo-100 text-indigo-600",
  violet: "bg-violet-100 text-violet-600",
  purple: "bg-purple-100 text-purple-600",
  fuchsia: "bg-fuchsia-100 text-fuchsia-600",
  rose: "bg-rose-100 text-rose-600",
  teal: "bg-teal-100 text-teal-600",
  amber: "bg-amber-100 text-amber-600",
};

const alertDot: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-orange-500",
  low: "bg-blue-500",
};
const alertBg: Record<string, string> = {
  high: "bg-red-50/70 hover:bg-red-100/70",
  medium: "bg-orange-50/70 hover:bg-orange-100/70",
  low: "bg-blue-50/70 hover:bg-blue-100/70",
};

const activityTag: Record<string, string> = {
  blue: "bg-blue-100 text-blue-700",
  indigo: "bg-indigo-100 text-indigo-700",
  violet: "bg-violet-100 text-violet-700",
  fuchsia: "bg-fuchsia-100 text-fuchsia-700",
  rose: "bg-rose-100 text-rose-700",
  teal: "bg-teal-100 text-teal-700",
  amber: "bg-amber-100 text-amber-700",
};
const activityIcon: Record<string, string> = {
  blue: "text-blue-500",
  indigo: "text-indigo-500",
  violet: "text-violet-500",
  fuchsia: "text-fuchsia-500",
  rose: "text-rose-500",
  teal: "text-teal-500",
  amber: "text-amber-500",
};

const CHART_COLORS = [
  "#818cf8",
  "#a78bfa",
  "#c084fc",
  "#2dd4bf",
  "#fbbf24",
  "#a5b4fc",
];

const headcountTrend = [
  { month: "Jan", headcount: 4480 },
  { month: "Feb", headcount: 4525 },
  { month: "Mar", headcount: 4598 },
  { month: "Apr", headcount: 4662 },
  { month: "May", headcount: 4744 },
  { month: "Jun", headcount: 4820 },
];

const deptDistribution = [
  { name: "Engineering", value: 1280 },
  { name: "Sales", value: 920 },
  { name: "Operations", value: 760 },
  { name: "Marketing", value: 540 },
  { name: "Finance", value: 480 },
  { name: "People & Admin", value: 840 },
];

const hiresAttrition = [
  { month: "Jan", hires: 64, exits: 38 },
  { month: "Feb", hires: 71, exits: 42 },
  { month: "Mar", hires: 83, exits: 35 },
  { month: "Apr", hires: 77, exits: 51 },
  { month: "May", hires: 88, exits: 44 },
  { month: "Jun", hires: 92, exits: 39 },
];

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function CheckInWidget() {
  const [checkedInAt, setCheckedInAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (checkedInAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [checkedInAt]);

  const isActive = checkedInAt !== null;
  const totalSec = isActive ? Math.floor((now - checkedInAt) / 1000) : 0;
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const checkInLabel = isActive
    ? new Date(checkedInAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="fusion-glass rounded-[2rem] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
      <div className="flex items-center gap-4">
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
            isActive
              ? "bg-gradient-to-br from-emerald-400 to-teal-500 text-white"
              : "bg-slate-100 text-slate-400"
          }`}
        >
          <Clock size={26} />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            {isActive && (
              <span className="relative flex h-2 w-2">
                <span className="fusion-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            )}
            {isActive ? "On the clock" : "Not checked in"}
          </p>
          <span
            className={`block text-4xl font-extrabold tracking-tight tabular-nums ${
              isActive ? "fusion-gradient-text" : "text-slate-300"
            }`}
          >
            {pad(hrs)}:{pad(mins)}:{pad(secs)}
          </span>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            {isActive ? `Checked in at ${checkInLabel}` : "Start your workday"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {!isActive ? (
          <button
            type="button"
            onClick={() => {
              const t = Date.now();
              setCheckedInAt(t);
              setNow(t);
            }}
            className="flex items-center gap-2 px-7 py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 transition-all active:scale-95"
          >
            <LogIn size={18} /> Check In
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCheckedInAt(null)}
            className="flex items-center gap-2 px-7 py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-rose-500 to-rose-600 shadow-lg shadow-rose-500/25 hover:shadow-xl hover:shadow-rose-500/30 transition-all active:scale-95"
          >
            <LogOut size={18} /> Check Out
          </button>
        )}
      </div>
    </div>
  );
}

export function Dashboard() {
  const dailyQuote = getDailyQuote(currentUser);
  const wx = weatherThemes[dailyWeather.condition];
  const WxIcon = wx.Icon;
  return (
    <div className="min-h-screen fusion-bg text-slate-900 font-['Plus_Jakarta_Sans',sans-serif] flex relative">
      {/* Floating mesh blobs — artistic depth (clipping scoped to this decorative layer only) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
        <div
          className="fusion-blob"
          style={{ width: 420, height: 420, top: -80, left: "30%", background: "radial-gradient(circle, #a5b4fc, #818cf8)" }}
        />
        <div
          className="fusion-blob fusion-blob-2"
          style={{ width: 360, height: 360, top: "20%", right: "-60px", background: "radial-gradient(circle, #c4b5fd, #a78bfa)" }}
        />
        <div
          className="fusion-blob fusion-blob-3"
          style={{ width: 380, height: 380, bottom: "-100px", left: "20%", background: "radial-gradient(circle, #99f6e4, #2dd4bf)" }}
        />
      </div>

      {/* Sidebar — glassmorphic (Aurora) */}
      <aside className="w-64 fusion-glass border-r border-white/40 flex-col z-10 hidden lg:flex relative">
        <div className="h-16 flex items-center px-6 border-b border-white/30">
          <img
            src={companyBranding.logo}
            alt={`${companyBranding.name} logo`}
            className="w-9 h-9 mr-3 object-contain drop-shadow-sm"
          />
          <span className="font-extrabold text-lg tracking-tight leading-tight">
            {companyBranding.name}
          </span>
        </div>

        <div className="p-4 flex-1 space-y-6">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">
              Core HCM
            </div>
            <nav className="space-y-1">
              {[
                { icon: LayoutGrid, label: "Dashboard", active: true },
                { icon: Network, label: "Organization" },
                { icon: Users, label: "Employees" },
                { icon: Calendar, label: "Time & Leave" },
                { icon: Wallet, label: "Payroll" },
              ].map((item, i) => (
                <a
                  key={i}
                  href="#"
                  className={`flex items-center px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    item.active
                      ? "bg-white/80 text-indigo-700 shadow-sm"
                      : "text-slate-600 hover:bg-white/50 hover:text-slate-900"
                  }`}
                >
                  <item.icon
                    size={18}
                    className={`mr-3 ${item.active ? "text-indigo-600" : "text-slate-400"}`}
                  />
                  {item.label}
                </a>
              ))}
            </nav>
          </div>

          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">
              System
            </div>
            <nav className="space-y-1">
              {[
                { icon: ShieldCheck, label: "Governance" },
                { icon: FileText, label: "Reports" },
                { icon: Settings, label: "Setup" },
              ].map((item, i) => (
                <a
                  key={i}
                  href="#"
                  className="flex items-center px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-white/50 hover:text-slate-900 transition-colors"
                >
                  <item.icon size={18} className="mr-3 text-slate-400" />
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </div>

        <div className="p-4 border-t border-white/30">
          <div className="flex items-center px-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-400 to-violet-400 flex items-center justify-center text-white font-bold text-sm border-2 border-white shadow-sm">
              JD
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-bold truncate">Jane Doe</p>
              <p className="text-xs text-slate-500 truncate">Global HR Admin</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 z-10 relative">
        {/* Top bar — glass */}
        <header className="h-16 fusion-glass border-b border-white/30 flex items-center justify-between px-6 lg:px-8 z-20">
          <div className="flex items-center lg:hidden">
            <Menu className="text-slate-500 mr-4" />
            <img
              src={companyBranding.logo}
              alt={`${companyBranding.name} logo`}
              className="w-7 h-7 mr-2 object-contain"
            />
            <span className="font-extrabold text-lg">{companyBranding.name}</span>
          </div>
          <div className="hidden lg:flex items-center max-w-md w-full relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              aria-label="Search employees, policies, reports"
              placeholder="Search employees, policies, reports..."
              className="w-full bg-white/55 border border-white/60 focus:bg-white/80 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none rounded-full pl-10 pr-4 py-2 text-sm placeholder:text-slate-400 transition-all shadow-inner"
            />
          </div>
          <div className="flex items-center space-x-3">
            <button aria-label="Notifications" className="relative p-2 text-slate-500 hover:text-slate-800 transition-colors bg-white/40 hover:bg-white/70 rounded-full border border-white/50">
              <BellRing size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border border-white" />
            </button>
            <button aria-label="Help" className="p-2 text-slate-500 hover:text-slate-800 transition-colors bg-white/40 hover:bg-white/70 rounded-full border border-white/50">
              <HelpCircle size={20} />
            </button>
            <a
              href="#"
              aria-label="View your profile"
              title="View your profile"
              className="ml-1 flex items-center gap-2.5 group"
            >
              <img
                src="https://randomuser.me/api/portraits/women/44.jpg"
                alt="Jane Doe profile"
                className="w-10 h-10 rounded-full object-cover ring-2 ring-white/70 shadow-md group-hover:ring-indigo-400 group-hover:scale-105 transition-all"
              />
              <span className="hidden xl:flex flex-col leading-tight">
                <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">
                  Jane Doe
                </span>
                <span className="text-[11px] font-medium text-slate-400">
                  Global HR Admin
                </span>
              </span>
            </a>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Page header */}
            <div className="flex flex-col lg:flex-row lg:items-stretch justify-between gap-6">
              <div className="flex flex-col justify-center">
                <div className="inline-flex self-start items-center gap-2 mb-3 pl-2 pr-3 py-1 rounded-full bg-white/60 border border-white/60 backdrop-blur-md text-xs font-bold text-slate-600">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="fusion-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  All systems operational · June 2026
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3">
                  <span className="fusion-gradient-text">Good morning, Jane</span>
                </h1>
                <p className="text-slate-600 max-w-2xl text-base md:text-lg font-medium leading-relaxed flex items-start gap-2.5">
                  <Quote
                    size={20}
                    className="text-amber-400 shrink-0 mt-1 -scale-x-100"
                    fill="currentColor"
                  />
                  <span className="italic">{dailyQuote}</span>
                </p>
              </div>

              {/* Daily weather — large graphic card */}
              <div
                aria-label={`Today's weather in ${dailyWeather.city}: ${dailyWeather.tempC} degrees, ${wx.label}`}
                className={`relative overflow-hidden shrink-0 w-full lg:w-[460px] rounded-2xl p-6 text-white bg-gradient-to-br ${wx.gradient} shadow-xl shadow-black/10`}
              >
                <div
                  className={`absolute -right-10 -top-10 w-48 h-48 rounded-full blur-2xl ${wx.glow}`}
                  aria-hidden="true"
                />
                <div className="relative z-10 flex items-stretch gap-6">
                  {/* Current conditions */}
                  <div className="flex flex-col justify-between flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white/80">
                          Today
                        </p>
                        <p className="text-lg font-bold leading-tight truncate">
                          {dailyWeather.city}
                        </p>
                      </div>
                      <WxIcon
                        size={48}
                        strokeWidth={1.75}
                        className="fusion-float shrink-0"
                      />
                    </div>

                    <div className="mt-3 flex items-end gap-2.5">
                      <span className="text-5xl font-extrabold leading-none tracking-tighter">
                        {dailyWeather.tempC}°
                      </span>
                      <div className="pb-1">
                        <p className="text-sm font-bold leading-tight">
                          {wx.label}
                        </p>
                        <p className="text-[11px] font-semibold text-white/80">
                          H:{dailyWeather.hiC}° · L:{dailyWeather.loC}°
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-4 text-xs font-semibold text-white/85">
                      <span className="flex items-center gap-1.5">
                        <Droplets size={14} /> {dailyWeather.humidity}%
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Wind size={14} /> {dailyWeather.wind} km/h
                      </span>
                    </div>
                  </div>

                  {/* 3-day forecast */}
                  <div className="flex flex-col gap-2 border-l border-white/25 pl-5">
                    {dailyWeather.forecast.map((f) => {
                      const FIcon = weatherThemes[f.condition].Icon;
                      return (
                        <div
                          key={f.day}
                          className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2"
                        >
                          <span className="text-[11px] font-bold text-white/80 w-7">
                            {f.day}
                          </span>
                          <FIcon size={18} strokeWidth={2} className="shrink-0" />
                          <span className="text-sm font-bold ml-auto">
                            {f.tempC}°
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Check-in / time tracker */}
            <CheckInWidget />

            {/* Vivid bento KPI tiles (Bento) */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {/* KPI 1 */}
              <div className="bg-gradient-to-br from-indigo-400 to-violet-500 text-white rounded-[2rem] p-6 fusion-hover flex flex-col justify-between h-[180px] shadow-lg shadow-indigo-500/15 relative overflow-hidden group">
                <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/15 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                <div className="flex justify-between items-start relative z-10">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                    <Users size={24} />
                  </div>
                  <ArrowRight size={20} className="text-indigo-100/80" />
                </div>
                <div className="relative z-10">
                  <div className="text-4xl font-extrabold mb-1">4,820</div>
                  <div className="text-indigo-50/90 text-sm font-medium">
                    Total Headcount · Current active
                  </div>
                </div>
              </div>
              {/* KPI 2 */}
              <div className="bg-gradient-to-br from-violet-400 to-purple-500 text-white rounded-[2rem] p-6 fusion-hover flex flex-col justify-between h-[180px] shadow-lg shadow-violet-500/15 relative overflow-hidden group">
                <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/15 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                <div className="flex justify-between items-start relative z-10">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                    <TrendingDown size={24} />
                  </div>
                  <div className="px-2.5 py-1 bg-violet-900/25 rounded-full text-xs font-bold backdrop-blur-sm">
                    -1.2%
                  </div>
                </div>
                <div className="relative z-10">
                  <div className="text-4xl font-extrabold mb-1">8.4%</div>
                  <div className="text-violet-50/90 text-sm font-medium">
                    Turnover Rate · Annualized
                  </div>
                </div>
              </div>
              {/* KPI 3 */}
              <div className="bg-gradient-to-br from-teal-400 to-emerald-500 text-white rounded-[2rem] p-6 fusion-hover flex flex-col justify-between h-[180px] shadow-lg shadow-emerald-500/15 relative overflow-hidden group">
                <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/15 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                <div className="flex justify-between items-start relative z-10">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                    <Briefcase size={24} />
                  </div>
                  <ArrowRight size={20} className="text-teal-100/80" />
                </div>
                <div className="relative z-10">
                  <div className="text-4xl font-extrabold mb-1">137</div>
                  <div className="text-teal-50/90 text-sm font-medium">
                    Open Positions · Demand
                  </div>
                </div>
              </div>
              {/* KPI 4 */}
              <div className="bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-[2rem] p-6 fusion-hover flex flex-col justify-between h-[180px] shadow-lg shadow-orange-500/15 relative overflow-hidden group">
                <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/15 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                <div className="flex justify-between items-start relative z-10">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                    <UserPlus size={24} />
                  </div>
                  <ArrowRight size={20} className="text-amber-100/80" />
                </div>
                <div className="relative z-10">
                  <div className="text-4xl font-extrabold mb-1">92</div>
                  <div className="text-amber-50/90 text-sm font-medium">
                    New Hires MTD · Volume
                  </div>
                </div>
              </div>
            </div>

            {/* Analytics — graphs */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Headcount growth — area, spans 2 */}
              <div className="lg:col-span-2 fusion-glass rounded-[2rem] p-6 lg:p-8 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <TrendingUp size={20} className="text-indigo-500" />
                    Headcount Growth
                  </h2>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-indigo-100 text-indigo-700">
                    Last 6 months
                  </span>
                </div>
                <div className="h-72 -ml-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ReAreaChart
                      data={headcountTrend}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="fusionHeadcount"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="5%" stopColor="#818cf8" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#a5b4fc" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e2e8f0"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="month"
                        tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        domain={["dataMin - 100", "dataMax + 80"]}
                        width={48}
                      />
                      <ReTooltip
                        contentStyle={{
                          borderRadius: 16,
                          border: "1px solid #e2e8f0",
                          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                          fontSize: 13,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="headcount"
                        stroke="#818cf8"
                        strokeWidth={3}
                        fill="url(#fusionHeadcount)"
                      />
                    </ReAreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Workforce by department — donut */}
              <div className="fusion-glass rounded-[2rem] p-6 lg:p-8 flex flex-col">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
                  <PieChart size={20} className="text-teal-500" />
                  By Department
                </h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={deptDistribution}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {deptDistribution.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <ReTooltip
                        contentStyle={{
                          borderRadius: 16,
                          border: "1px solid #e2e8f0",
                          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                          fontSize: 13,
                        }}
                      />
                      <Legend
                        iconType="circle"
                        wrapperStyle={{ fontSize: 12, fontWeight: 600 }}
                      />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Hires vs attrition — bar, full width */}
              <div className="lg:col-span-3 fusion-glass rounded-[2rem] p-6 lg:p-8 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <BarChart3 size={20} className="text-violet-500" />
                    Hires vs Attrition
                  </h2>
                  <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-indigo-400" /> Hires
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-amber-300" /> Exits
                    </span>
                  </div>
                </div>
                <div className="h-72 -ml-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ReBarChart
                      data={hiresAttrition}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      barGap={6}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e2e8f0"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="month"
                        tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        width={36}
                      />
                      <ReTooltip
                        cursor={{ fill: "rgba(99,102,241,0.06)" }}
                        contentStyle={{
                          borderRadius: 16,
                          border: "1px solid #e2e8f0",
                          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                          fontSize: 13,
                        }}
                      />
                      <Bar
                        dataKey="hires"
                        fill="#818cf8"
                        radius={[8, 8, 0, 0]}
                        maxBarSize={34}
                      />
                      <Bar
                        dataKey="exits"
                        fill="#fbbf24"
                        radius={[8, 8, 0, 0]}
                        maxBarSize={34}
                      />
                    </ReBarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Bento body: flow (glass) + alerts (glass) + activity (glass) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Operating flow — glass, spans 2 */}
              <div className="lg:col-span-2 fusion-glass rounded-[2rem] p-8 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Zap size={20} className="text-indigo-500" />
                    One HCM Operating Flow
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { title: "People & Organization", desc: "Legal entities, departments, org units, positions, and manager lines.", icon: Network, color: "blue" },
                    { title: "Employee Records", desc: "Worker profiles power self-service, payroll, and approvals.", icon: FolderOpen, color: "indigo" },
                    { title: "Leave & Attendance", desc: "Policy-driven leave balances, approval queues, shifts, and attendance.", icon: Calendar, color: "violet" },
                    { title: "Payroll & Reward", desc: "Payroll operations consume attendance, leave, worker, and benefits data.", icon: Wallet, color: "purple" },
                    { title: "Governance", desc: "Country policy, compliance controls, allowed actions, and audit readiness.", icon: ShieldCheck, color: "teal" },
                    { title: "Employee Mode Preview", desc: "Switch personas to verify the self-service experience.", icon: Eye, color: "rose" },
                  ].map((mod, i) => (
                    <div
                      key={i}
                      className="bg-white/55 hover:bg-white/80 border border-white/60 rounded-2xl p-5 cursor-pointer flex gap-4 transition-all hover:shadow-md"
                    >
                      <div
                        className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center ${moduleIcon[mod.color]}`}
                      >
                        <mod.icon size={22} />
                      </div>
                      <div>
                        <h4 className="font-bold mb-1 leading-tight">{mod.title}</h4>
                        <p className="text-sm text-slate-500 font-medium leading-relaxed">
                          {mod.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right column: alerts + activity */}
              <div className="space-y-6 flex flex-col">
                {/* Alerts — glass */}
                <div className="fusion-glass rounded-[2rem] p-6 flex flex-col">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      <AlertTriangle className="text-orange-500" size={20} />
                      Attention Required
                    </h2>
                    <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2.5 py-1 rounded-full">
                      4
                    </span>
                  </div>
                  <div className="space-y-3">
                    {[
                      { severity: "high", title: "23 work permits expire within 30 days", time: "Urgent" },
                      { severity: "medium", title: "Payroll cutoff for APAC region is in 2 days", time: "Upcoming" },
                      { severity: "medium", title: "14 performance reviews overdue", time: "Overdue" },
                      { severity: "low", title: "Q3 org chart pending manager sign-off", time: "Pending" },
                    ].map((a, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-3 p-3 rounded-xl transition-colors cursor-pointer border border-white/40 ${alertBg[a.severity]}`}
                      >
                        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${alertDot[a.severity]}`} />
                        <div className="flex-1">
                          <p className="text-sm font-bold leading-snug">{a.title}</p>
                          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                            {a.time}
                          </p>
                        </div>
                        <ChevronRight size={16} className="text-slate-400 mt-1 shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent activity — glass panel */}
                <div className="fusion-glass rounded-[2rem] p-6 flex flex-col relative overflow-hidden flex-1">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-400/15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                  <div className="flex items-center justify-between mb-5 relative z-10">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      <Clock className="text-indigo-500" size={20} />
                      Recent Activity
                    </h2>
                  </div>
                  <div className="space-y-5 relative z-10">
                    {[
                      { icon: CheckCircle2, title: "Maria Santos approved 4 leave requests", time: "12m ago", tag: "Leave", color: "blue" },
                      { icon: UserPlus, title: "New hire onboarding completed for D. Okafor", time: "1h ago", tag: "Onboarding", color: "amber" },
                      { icon: Wallet, title: "Payroll run PR-2026-06 locked for EMEA", time: "3h ago", tag: "Payroll", color: "indigo" },
                      { icon: Network, title: "Org unit 'Growth Marketing' created", time: "5h ago", tag: "Org", color: "violet" },
                      { icon: FileText, title: "Compliance policy updated: Germany", time: "Yesterday", tag: "Governance", color: "rose" },
                    ].map((act, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="w-[26px] h-[26px] rounded-full bg-white flex items-center justify-center shrink-0 ring-4 ring-white/60 shadow-sm">
                          <act.icon size={15} className={activityIcon[act.color]} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-700 mb-1.5 leading-snug">
                            {act.title}
                          </p>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${activityTag[act.color]}`}
                            >
                              {act.tag}
                            </span>
                            <span className="text-xs font-medium text-slate-500">
                              {act.time}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
