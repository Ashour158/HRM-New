import React, { useState } from 'react';
import {
  Search, Bell, Settings, LayoutDashboard, Users, FileText,
  Calendar, DollarSign, Shield, Eye, AlertTriangle, Info,
  CheckCircle2, UserPlus, Lock, FolderPlus, FileEdit, ChevronRight,
  MoreHorizontal, Play, Briefcase, FileSignature, Globe, AlertCircle
} from 'lucide-react';

// --- Data ---
const kpis = [
  { label: 'Total Headcount', value: '4,820', helper: 'Current active workforce', trend: '+12', color: 'bg-indigo-50 text-indigo-600', icon: Users },
  { label: 'Turnover Rate', value: '8.4%', helper: 'Annualized movement', trend: '-1.2%', color: 'bg-emerald-50 text-emerald-600', icon: Briefcase },
  { label: 'Open Positions', value: '137', helper: 'Recruiting & demand', trend: '+5', color: 'bg-orange-50 text-orange-600', icon: UserPlus },
  { label: 'New Hires MTD', value: '92', helper: 'Month-to-date volume', trend: '+18', color: 'bg-sky-50 text-sky-600', icon: FileSignature },
];

const modules = [
  { title: 'People & Organization', desc: 'Legal entities, departments, org units, positions, and manager lines.', icon: Users, color: 'bg-indigo-100 text-indigo-700' },
  { title: 'Employee Records', desc: 'Worker profiles power self-service, payroll, and approvals.', icon: FileText, color: 'bg-rose-100 text-rose-700' },
  { title: 'Leave & Attendance', desc: 'Policy-driven leave balances, approval queues, shifts, and attendance.', icon: Calendar, color: 'bg-amber-100 text-amber-700' },
  { title: 'Payroll & Reward', desc: 'Payroll operations consume attendance, leave, worker, and benefits data.', icon: DollarSign, color: 'bg-emerald-100 text-emerald-700' },
  { title: 'Governance', desc: 'Country policy, compliance controls, allowed actions, and audit readiness.', icon: Shield, color: 'bg-slate-100 text-slate-700' },
  { title: 'Employee Mode Preview', desc: 'Switch personas to verify the self-service experience.', icon: Eye, color: 'bg-sky-100 text-sky-700' },
];

const alerts = [
  { severity: 'high', text: '23 work permits expire within 30 days' },
  { severity: 'medium', text: 'Payroll cutoff for APAC region is in 2 days' },
  { severity: 'medium', text: '14 performance reviews overdue' },
  { severity: 'low', text: 'Q3 org chart pending manager sign-off' },
];

const activities = [
  { text: 'Maria Santos approved 4 leave requests', time: '12m ago', type: 'Leave', icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-50' },
  { text: 'New hire onboarding completed for D. Okafor', time: '1h ago', type: 'Onboarding', icon: UserPlus, color: 'text-sky-500 bg-sky-50' },
  { text: 'Payroll run PR-2026-06 locked for EMEA', time: '3h ago', type: 'Payroll', icon: Lock, color: 'text-indigo-500 bg-indigo-50' },
  { text: "Org unit 'Growth Marketing' created", time: '5h ago', type: 'Org', icon: FolderPlus, color: 'text-orange-500 bg-orange-50' },
  { text: 'Compliance policy updated: Germany', time: 'Yesterday', type: 'Governance', icon: FileEdit, color: 'text-rose-500 bg-rose-50' },
];

const quickLinks = [
  'Module Workbench', 'Organization', 'Employees', 'Service Delivery',
  'Attendance', 'Leave', 'Payroll', 'Country Policy'
];

export function Pastel() {
  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div 
        className="min-h-screen bg-[#FDFBF9] text-slate-700 flex flex-col md:flex-row w-full overflow-hidden"
        style={{ fontFamily: "'Quicksand', sans-serif" }}
      >
        {/* Sidebar */}
        <aside className="w-full md:w-64 bg-[#F5F2F0] border-r border-stone-200/50 flex flex-col flex-shrink-0">
          <div className="p-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-200 to-purple-200 flex items-center justify-center text-indigo-700 shadow-sm">
              <Globe size={24} strokeWidth={2.5} />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-800">Lumina HR</span>
          </div>
          
          <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto">
            <NavItem icon={LayoutDashboard} label="Overview" active />
            <NavItem icon={Users} label="Organization" />
            <NavItem icon={FileText} label="Employees" />
            <NavItem icon={Calendar} label="Time & Leave" />
            <NavItem icon={DollarSign} label="Payroll" />
            <NavItem icon={Shield} label="Governance" />
          </nav>

          <div className="p-4 mt-auto">
            <div className="p-3 rounded-3xl bg-white border border-stone-100 shadow-sm flex items-center gap-3 cursor-pointer hover:bg-stone-50 transition-colors">
              <div className="w-10 h-10 rounded-full bg-orange-100 border-2 border-white shadow-sm flex items-center justify-center text-orange-600 font-bold">
                AJ
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-semibold text-slate-800 truncate">Alex Jensen</p>
                <p className="text-xs text-slate-500 truncate">Global HR Admin</p>
              </div>
              <Settings size={18} className="text-slate-400" />
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative">
          
          {/* Topbar */}
          <header className="h-20 px-8 flex items-center justify-between flex-shrink-0 z-10">
            <div className="relative w-96 max-w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search employees, policies, or modules..." 
                className="w-full pl-11 pr-4 py-2.5 bg-white border border-stone-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all shadow-sm placeholder-slate-400"
              />
            </div>
            <div className="flex items-center gap-4">
              <button className="w-11 h-11 rounded-full bg-white border border-stone-200 flex items-center justify-center text-slate-500 hover:bg-stone-50 hover:text-slate-700 transition-colors relative shadow-sm">
                <Bell size={20} />
                <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-rose-400 rounded-full border-2 border-white"></span>
              </button>
            </div>
          </header>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-8 pb-12">
            <div className="max-w-7xl mx-auto space-y-10">
              
              {/* Page Header */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-4">
                <div>
                  <h1 className="text-4xl font-bold text-slate-800 tracking-tight mb-2">Overview</h1>
                  <p className="text-slate-500 text-lg max-w-2xl leading-relaxed">
                    One HCM workspace for organization setup, employee self-service, workforce policy, payroll, and governance.
                  </p>
                </div>
                <button className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-50 text-indigo-700 font-semibold rounded-2xl hover:bg-indigo-100 transition-colors shadow-sm whitespace-nowrap">
                  <LayoutDashboard size={18} />
                  Module Catalog
                </button>
              </div>

              {/* Quick Links Row */}
              <div className="flex flex-wrap gap-2">
                {quickLinks.map(link => (
                  <button key={link} className="px-5 py-2 bg-white border border-stone-200 text-slate-600 rounded-full text-sm font-medium hover:border-indigo-200 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all shadow-sm">
                    {link}
                  </button>
                ))}
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {kpis.map((kpi, i) => {
                  const Icon = kpi.icon;
                  return (
                    <div key={i} className="bg-white rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-stone-100 flex flex-col group hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${kpi.color}`}>
                          <Icon size={24} strokeWidth={2} />
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${kpi.trend.startsWith('+') ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          {kpi.trend}
                        </span>
                      </div>
                      <h3 className="text-slate-500 text-sm font-semibold mb-1">{kpi.label}</h3>
                      <div className="text-3xl font-bold text-slate-800 tracking-tight mb-1">{kpi.value}</div>
                      <p className="text-xs text-slate-400 mt-auto">{kpi.helper}</p>
                    </div>
                  );
                })}
              </div>

              {/* Main Grid: Operating Flow + Sidebars */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                
                {/* Operating Flow */}
                <div className="xl:col-span-2 space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-slate-800">One HCM Operating Flow</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {modules.map((mod, i) => {
                      const Icon = mod.icon;
                      return (
                        <div key={i} className="bg-white rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-stone-100 hover:border-indigo-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all cursor-pointer group flex flex-col">
                          <div className={`w-14 h-14 rounded-3xl flex items-center justify-center mb-5 ${mod.color}`}>
                            <Icon size={28} strokeWidth={2} />
                          </div>
                          <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">{mod.title}</h3>
                          <p className="text-slate-500 text-sm leading-relaxed mb-6 flex-1">{mod.desc}</p>
                          <div className="flex items-center text-sm font-semibold text-slate-400 group-hover:text-indigo-600 transition-colors mt-auto">
                            Open Workspace <ChevronRight size={16} className="ml-1" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Sidebar: Alerts & Activity */}
                <div className="space-y-8">
                  
                  {/* Alerts Panel */}
                  <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-stone-100 overflow-hidden">
                    <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                      <h2 className="text-xl font-bold text-slate-800">Action Required</h2>
                      <span className="bg-rose-100 text-rose-600 text-xs font-bold px-2.5 py-1 rounded-full">{alerts.length} New</span>
                    </div>
                    <div className="p-3">
                      {alerts.map((alert, i) => (
                        <div key={i} className="flex items-start gap-4 p-3 rounded-2xl hover:bg-stone-50 transition-colors cursor-pointer">
                          <div className="mt-0.5">
                            {alert.severity === 'high' && <AlertTriangle size={18} className="text-rose-500" />}
                            {alert.severity === 'medium' && <AlertCircle size={18} className="text-amber-500" />}
                            {alert.severity === 'low' && <Info size={18} className="text-sky-500" />}
                          </div>
                          <p className="text-sm text-slate-600 font-medium leading-snug pr-2">{alert.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Activity Feed */}
                  <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-stone-100 overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-stone-100">
                      <h2 className="text-xl font-bold text-slate-800">Recent Activity</h2>
                    </div>
                    <div className="p-6 flex-1">
                      <div className="space-y-6 relative before:absolute before:inset-0 before:ml-[1.4rem] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-stone-200 before:to-transparent">
                        {activities.map((act, i) => {
                          const Icon = act.icon;
                          return (
                            <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                              <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-white shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 absolute left-0 md:left-1/2 z-10">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${act.color}`}>
                                  <Icon size={14} strokeWidth={2.5} />
                                </div>
                              </div>
                              <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] ml-12 md:ml-0 p-4 rounded-2xl bg-stone-50/50 border border-stone-100 hover:bg-stone-50 transition-colors cursor-pointer">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-semibold text-slate-400">{act.type}</span>
                                  <span className="text-[11px] font-medium text-slate-400">{act.time}</span>
                                </div>
                                <p className="text-sm text-slate-700 font-medium leading-snug">{act.text}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <button className="p-4 text-center text-sm font-bold text-indigo-600 hover:bg-indigo-50 transition-colors border-t border-stone-100">
                      View Full Log
                    </button>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </main>
      </div>
    </>
  );
}

function NavItem({ icon: Icon, label, active = false }: { icon: any, label: string, active?: boolean }) {
  return (
    <a href="#" className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
      active 
        ? 'bg-white text-indigo-600 shadow-sm border border-stone-100/50 font-bold' 
        : 'text-slate-500 hover:bg-stone-100 hover:text-slate-700 font-semibold'
    }`}>
      <Icon size={20} strokeWidth={active ? 2.5 : 2} className={active ? "text-indigo-500" : ""} />
      <span>{label}</span>
    </a>
  );
}
