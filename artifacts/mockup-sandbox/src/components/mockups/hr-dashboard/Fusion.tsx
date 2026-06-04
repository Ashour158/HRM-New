import React from "react";
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
} from "lucide-react";
import "./fusion/_group.css";

const moduleIcon: Record<string, string> = {
  blue: "bg-blue-100 text-blue-600",
  indigo: "bg-indigo-100 text-indigo-600",
  violet: "bg-violet-100 text-violet-600",
  purple: "bg-purple-100 text-purple-600",
  fuchsia: "bg-fuchsia-100 text-fuchsia-600",
  rose: "bg-rose-100 text-rose-600",
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
  blue: "bg-blue-400/20 text-blue-300",
  indigo: "bg-indigo-400/20 text-indigo-300",
  violet: "bg-violet-400/20 text-violet-300",
  fuchsia: "bg-fuchsia-400/20 text-fuchsia-300",
  rose: "bg-rose-400/20 text-rose-300",
};
const activityIcon: Record<string, string> = {
  blue: "text-blue-400",
  indigo: "text-indigo-400",
  violet: "text-violet-400",
  fuchsia: "text-fuchsia-400",
  rose: "text-rose-400",
};

export function Fusion() {
  return (
    <div className="min-h-screen fusion-bg text-slate-900 font-['Plus_Jakarta_Sans',sans-serif] flex">
      {/* Sidebar — glassmorphic (Aurora) */}
      <aside className="w-64 fusion-glass border-r border-white/40 flex-col z-10 hidden lg:flex relative">
        <div className="h-16 flex items-center px-6 border-b border-white/30">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white mr-3 shadow-lg shadow-indigo-500/25">
            <Zap size={18} fill="currentColor" />
          </div>
          <span className="font-extrabold text-xl tracking-tight">Lumina HR</span>
        </div>

        <div className="p-4 flex-1 space-y-6">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">
              Core HCM
            </div>
            <nav className="space-y-1">
              {[
                { icon: LayoutGrid, label: "Overview", active: true },
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
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-400 to-pink-400 flex items-center justify-center text-white font-bold text-sm border-2 border-white shadow-sm">
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
            <span className="font-extrabold text-lg">Lumina HR</span>
          </div>
          <div className="hidden lg:flex items-center max-w-md w-full relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search employees, policies, reports..."
              className="w-full bg-white/55 border border-white/60 focus:bg-white/80 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none rounded-full pl-10 pr-4 py-2 text-sm placeholder:text-slate-400 transition-all shadow-inner"
            />
          </div>
          <div className="flex items-center space-x-3">
            <button className="relative p-2 text-slate-500 hover:text-slate-800 transition-colors bg-white/40 hover:bg-white/70 rounded-full border border-white/50">
              <BellRing size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border border-white" />
            </button>
            <button className="p-2 text-slate-500 hover:text-slate-800 transition-colors bg-white/40 hover:bg-white/70 rounded-full border border-white/50">
              <HelpCircle size={20} />
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Page header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
                  Overview
                </h1>
                <p className="text-slate-500 max-w-2xl text-sm md:text-base leading-relaxed">
                  One HCM workspace for organization setup, employee self-service,
                  workforce policy, payroll, and governance.
                </p>
              </div>
              <button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-indigo-500/25 flex items-center transition-all hover:scale-105 active:scale-95 shrink-0">
                <LayoutGrid size={18} className="mr-2" />
                Module Catalog
              </button>
            </div>

            {/* Quick links */}
            <div className="flex flex-wrap gap-3">
              {[
                "Module Workbench",
                "Organization",
                "Employees",
                "Service Delivery",
                "Attendance",
                "Leave",
                "Payroll",
                "Country Policy",
              ].map((link, i) => (
                <a
                  key={i}
                  href="#"
                  className="text-xs font-semibold px-4 py-2 bg-white/60 hover:bg-white border border-white/60 rounded-full text-slate-600 hover:text-indigo-600 hover:shadow-sm transition-all backdrop-blur-md whitespace-nowrap flex items-center"
                >
                  {link} <ChevronRight size={14} className="ml-1 opacity-50" />
                </a>
              ))}
            </div>

            {/* Vivid bento KPI tiles (Bento) */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {/* KPI 1 */}
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-[2rem] p-6 fusion-hover flex flex-col justify-between h-[180px] shadow-lg shadow-indigo-500/20 relative overflow-hidden group">
                <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/15 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                <div className="flex justify-between items-start relative z-10">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                    <Users size={24} />
                  </div>
                  <ArrowRight size={20} className="text-blue-100/80" />
                </div>
                <div className="relative z-10">
                  <div className="text-4xl font-extrabold mb-1">4,820</div>
                  <div className="text-blue-50/90 text-sm font-medium">
                    Total Headcount · Current active
                  </div>
                </div>
              </div>
              {/* KPI 2 */}
              <div className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-[2rem] p-6 fusion-hover flex flex-col justify-between h-[180px] shadow-lg shadow-violet-500/20 relative overflow-hidden group">
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
                  <div className="text-indigo-50/90 text-sm font-medium">
                    Turnover Rate · Annualized
                  </div>
                </div>
              </div>
              {/* KPI 3 */}
              <div className="bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white rounded-[2rem] p-6 fusion-hover flex flex-col justify-between h-[180px] shadow-lg shadow-fuchsia-500/20 relative overflow-hidden group">
                <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/15 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                <div className="flex justify-between items-start relative z-10">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                    <Briefcase size={24} />
                  </div>
                  <ArrowRight size={20} className="text-violet-100/80" />
                </div>
                <div className="relative z-10">
                  <div className="text-4xl font-extrabold mb-1">137</div>
                  <div className="text-violet-50/90 text-sm font-medium">
                    Open Positions · Demand
                  </div>
                </div>
              </div>
              {/* KPI 4 */}
              <div className="bg-gradient-to-br from-fuchsia-500 to-rose-500 text-white rounded-[2rem] p-6 fusion-hover flex flex-col justify-between h-[180px] shadow-lg shadow-rose-500/20 relative overflow-hidden group">
                <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/15 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                <div className="flex justify-between items-start relative z-10">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                    <UserPlus size={24} />
                  </div>
                  <ArrowRight size={20} className="text-fuchsia-100/80" />
                </div>
                <div className="relative z-10">
                  <div className="text-4xl font-extrabold mb-1">92</div>
                  <div className="text-fuchsia-50/90 text-sm font-medium">
                    New Hires MTD · Volume
                  </div>
                </div>
              </div>
            </div>

            {/* Bento body: flow (glass) + alerts (glass) + activity (dark) */}
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
                    { title: "Governance", desc: "Country policy, compliance controls, allowed actions, and audit readiness.", icon: ShieldCheck, color: "fuchsia" },
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

                {/* Recent activity — dark panel (Bento contrast pop) */}
                <div className="bg-[#1e293b] text-white rounded-[2rem] p-6 flex flex-col relative overflow-hidden flex-1">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                  <div className="flex items-center justify-between mb-5 relative z-10">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      <Clock className="text-slate-400" size={20} />
                      Recent Activity
                    </h2>
                  </div>
                  <div className="space-y-5 relative z-10">
                    {[
                      { icon: CheckCircle2, title: "Maria Santos approved 4 leave requests", time: "12m ago", tag: "Leave", color: "blue" },
                      { icon: UserPlus, title: "New hire onboarding completed for D. Okafor", time: "1h ago", tag: "Onboarding", color: "fuchsia" },
                      { icon: Wallet, title: "Payroll run PR-2026-06 locked for EMEA", time: "3h ago", tag: "Payroll", color: "indigo" },
                      { icon: Network, title: "Org unit 'Growth Marketing' created", time: "5h ago", tag: "Org", color: "violet" },
                      { icon: FileText, title: "Compliance policy updated: Germany", time: "Yesterday", tag: "Governance", color: "rose" },
                    ].map((act, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="w-[26px] h-[26px] rounded-full bg-slate-800 flex items-center justify-center shrink-0 ring-4 ring-[#1e293b]">
                          <act.icon size={15} className={activityIcon[act.color]} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-200 mb-1.5 leading-snug">
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
