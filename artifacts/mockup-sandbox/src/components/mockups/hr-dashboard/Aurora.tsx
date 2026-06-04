import React from 'react';
import { 
  Users, TrendingDown, Briefcase, UserPlus, 
  Building2, FileText, CalendarClock, CreditCard, 
  ShieldCheck, ArrowRightLeft, Bell, Activity, 
  Search, LayoutGrid, Settings, HelpCircle,
  Menu, BellRing, LogOut, ChevronRight, Zap
} from 'lucide-react';
import './aurora/_group.css';

const moduleIcon: Record<string, string> = {
  indigo: 'bg-indigo-100 text-indigo-600',
  blue: 'bg-blue-100 text-blue-600',
  emerald: 'bg-emerald-100 text-emerald-600',
  amber: 'bg-amber-100 text-amber-600',
  rose: 'bg-rose-100 text-rose-600',
  purple: 'bg-purple-100 text-purple-600',
};
const dotBorder: Record<string, string> = {
  emerald: 'border-emerald-400',
  purple: 'border-purple-400',
  amber: 'border-amber-400',
  indigo: 'border-indigo-400',
  rose: 'border-rose-400',
};
const dotBg: Record<string, string> = {
  emerald: 'bg-emerald-500',
  purple: 'bg-purple-500',
  amber: 'bg-amber-500',
  indigo: 'bg-indigo-500',
  rose: 'bg-rose-500',
};
const tagText: Record<string, string> = {
  emerald: 'text-emerald-600',
  purple: 'text-purple-600',
  amber: 'text-amber-600',
  indigo: 'text-indigo-600',
  rose: 'text-rose-600',
};

export function Aurora() {
  return (
    <div className="min-h-screen aurora-bg font-['Outfit',sans-serif] text-slate-800 flex">
      {/* Sidebar */}
      <aside className="w-64 glass-panel border-r border-white/40 flex-shrink-0 flex flex-col z-10 hidden lg:flex">
        <div className="h-16 flex items-center px-6 border-b border-white/30">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white mr-3 shadow-lg shadow-indigo-500/20">
            <Zap size={18} fill="currentColor" />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900">Lumina HR</span>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto space-y-6">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">Core HCM</div>
            <nav className="space-y-1">
              {[
                { icon: LayoutGrid, label: 'Overview', active: true },
                { icon: Building2, label: 'Organization' },
                { icon: Users, label: 'Employees' },
                { icon: CalendarClock, label: 'Time & Leave' },
                { icon: CreditCard, label: 'Payroll' },
              ].map((item, i) => (
                <a key={i} href="#" className={`flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${item.active ? 'bg-white/80 text-indigo-700 shadow-sm' : 'text-slate-600 hover:bg-white/50 hover:text-slate-900'}`}>
                  <item.icon size={18} className={`mr-3 ${item.active ? 'text-indigo-600' : 'text-slate-400'}`} />
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
          
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">System</div>
            <nav className="space-y-1">
              {[
                { icon: ShieldCheck, label: 'Governance' },
                { icon: FileText, label: 'Reports' },
                { icon: Settings, label: 'Setup' },
              ].map((item, i) => (
                <a key={i} href="#" className="flex items-center px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-white/50 hover:text-slate-900 transition-colors">
                  <item.icon size={18} className="mr-3 text-slate-400" />
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </div>
        
        <div className="p-4 border-t border-white/30">
          <div className="flex items-center px-2">
            <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=Sarah&backgroundColor=e0e7ff`} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" alt="User" />
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">Sarah Miller</p>
              <p className="text-xs text-slate-500 truncate">Global HR Admin</p>
            </div>
            <LogOut size={16} className="text-slate-400 hover:text-slate-700 cursor-pointer" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 z-10 relative">
        {/* Top Navbar */}
        <header className="h-16 glass-panel border-b border-white/30 flex items-center justify-between px-6 lg:px-8 z-20 shrink-0">
          <div className="flex items-center lg:hidden">
            <Menu className="text-slate-500 mr-4" />
            <span className="font-bold text-lg text-slate-900">Lumina HR</span>
          </div>
          
          <div className="hidden lg:flex items-center max-w-md w-full relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search employees, policies, reports..." 
              className="w-full bg-white/50 border border-white/60 focus:bg-white/80 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none rounded-full pl-10 pr-4 py-2 text-sm placeholder:text-slate-400 transition-all shadow-inner"
            />
          </div>
          
          <div className="flex items-center space-x-4">
            <button className="relative p-2 text-slate-500 hover:text-slate-800 transition-colors bg-white/40 hover:bg-white/70 rounded-full border border-white/50">
              <BellRing size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
            </button>
            <button className="p-2 text-slate-500 hover:text-slate-800 transition-colors bg-white/40 hover:bg-white/70 rounded-full border border-white/50">
              <HelpCircle size={20} />
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-2">Overview</h1>
                <p className="text-slate-500 max-w-2xl text-sm md:text-base leading-relaxed">
                  One HCM workspace for organization setup, employee self-service, workforce policy, payroll, and governance.
                </p>
              </div>
              <button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-indigo-500/25 flex items-center transition-all hover:scale-105 active:scale-95 shrink-0">
                <LayoutGrid size={18} className="mr-2" />
                Module Catalog
              </button>
            </div>

            {/* Quick Links Row */}
            <div className="flex flex-wrap gap-3">
              {['Module Workbench', 'Organization', 'Employees', 'Service Delivery', 'Attendance', 'Leave', 'Payroll', 'Country Policy'].map((link, i) => (
                <a key={i} href="#" className="text-xs font-medium px-4 py-2 bg-white/60 hover:bg-white border border-white/60 rounded-full text-slate-600 hover:text-indigo-600 hover:shadow-sm transition-all backdrop-blur-md whitespace-nowrap flex items-center">
                  {link} <ChevronRight size={14} className="ml-1 opacity-50" />
                </a>
              ))}
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { title: 'Total Headcount', value: '4,820', sub: 'Current active workforce', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', line: 'from-blue-400 to-cyan-400' },
                { title: 'Turnover Rate', value: '8.4%', sub: 'Annualized movement', icon: TrendingDown, color: 'text-emerald-600', bg: 'bg-emerald-50', line: 'from-emerald-400 to-teal-400' },
                { title: 'Open Positions', value: '137', sub: 'Recruiting & workforce demand', icon: Briefcase, color: 'text-amber-600', bg: 'bg-amber-50', line: 'from-amber-400 to-orange-400' },
                { title: 'New Hires MTD', value: '92', sub: 'Month-to-date onboarding volume', icon: UserPlus, color: 'text-purple-600', bg: 'bg-purple-50', line: 'from-purple-400 to-fuchsia-400' },
              ].map((stat, i) => (
                <div key={i} className="glass-panel glass-panel-hover rounded-2xl p-5 relative overflow-hidden group">
                  <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${stat.line} opacity-70`}></div>
                  <div className="flex justify-between items-start mb-4">
                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">{stat.title}</p>
                    <div className={`${stat.bg} ${stat.color} p-2 rounded-xl`}>
                      <stat.icon size={20} />
                    </div>
                  </div>
                  <h3 className="text-3xl font-bold text-slate-900 tracking-tight mb-1">{stat.value}</h3>
                  <p className="text-xs text-slate-500">{stat.sub}</p>
                  
                  {/* Decorative blur blob */}
                  <div className={`absolute -bottom-6 -right-6 w-24 h-24 ${stat.bg} rounded-full blur-2xl opacity-50 group-hover:opacity-100 transition-opacity`}></div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Modules (2/3 width) */}
              <div className="lg:col-span-2 space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center">
                    <Zap size={20} className="mr-2 text-indigo-500" /> 
                    One HCM Operating Flow
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { title: 'People & Organization', desc: 'Legal entities, departments, org units, positions, and manager lines.', icon: Building2, color: 'indigo' },
                      { title: 'Employee Records', desc: 'Worker profiles power self-service, payroll, and approvals.', icon: FileText, color: 'blue' },
                      { title: 'Leave & Attendance', desc: 'Policy-driven leave balances, approval queues, shifts, and attendance.', icon: CalendarClock, color: 'emerald' },
                      { title: 'Payroll & Reward', desc: 'Payroll operations consume attendance, leave, worker, and benefits data.', icon: CreditCard, color: 'amber' },
                      { title: 'Governance', desc: 'Country policy, compliance controls, allowed actions, and audit readiness.', icon: ShieldCheck, color: 'rose' },
                      { title: 'Employee Mode Preview', desc: 'Switch personas to verify the self-service experience.', icon: ArrowRightLeft, color: 'purple' },
                    ].map((mod, i) => (
                      <div key={i} className="glass-panel glass-panel-hover rounded-xl p-5 cursor-pointer flex gap-4">
                        <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center ${moduleIcon[mod.color]}`}>
                          <mod.icon size={24} />
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-900 mb-1">{mod.title}</h4>
                          <p className="text-xs text-slate-500 leading-relaxed">{mod.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sidebar content (1/3 width) */}
              <div className="space-y-6 lg:col-span-1">
                {/* Alerts */}
                <div className="glass-panel rounded-2xl overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-white/40 bg-white/20 backdrop-blur-md flex justify-between items-center sticky top-0 z-10">
                    <h3 className="font-bold text-slate-900 flex items-center">
                      <Bell size={18} className="mr-2 text-rose-500" /> Needs Attention
                    </h3>
                    <span className="text-xs font-medium bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">4 items</span>
                  </div>
                  <div className="p-4 space-y-4 overflow-y-auto flex-1">
                    {[
                      { sev: 'high', text: '23 work permits expire within 30 days', dot: 'bg-rose-500', bg: 'bg-rose-50' },
                      { sev: 'medium', text: 'Payroll cutoff for APAC region is in 2 days', dot: 'bg-amber-500', bg: 'bg-amber-50' },
                      { sev: 'medium', text: '14 performance reviews overdue', dot: 'bg-amber-500', bg: 'bg-amber-50' },
                      { sev: 'low', text: 'Q3 org chart pending manager sign-off', dot: 'bg-blue-500', bg: 'bg-blue-50' },
                    ].map((alert, i) => (
                      <div key={i} className="flex items-start bg-white/40 p-3 rounded-lg border border-white/50 hover:bg-white/60 transition-colors cursor-pointer">
                        <div className={`w-2.5 h-2.5 rounded-full ${alert.dot} mt-1.5 mr-3 shrink-0 shadow-sm`} />
                        <span className="text-sm text-slate-700 font-medium leading-snug">{alert.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Activity Feed */}
                <div className="glass-panel rounded-2xl overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-white/40 bg-white/20 backdrop-blur-md sticky top-0 z-10">
                    <h3 className="font-bold text-slate-900 flex items-center">
                      <Activity size={18} className="mr-2 text-indigo-500" /> Recent Activity
                    </h3>
                  </div>
                  <div className="p-4 space-y-5 overflow-y-auto flex-1 relative">
                    <div className="absolute left-[27px] top-6 bottom-4 w-px bg-slate-200/60 z-0"></div>
                    {[
                      { text: 'Maria Santos approved 4 leave requests', time: '12m ago', tag: 'Leave', color: 'emerald' },
                      { text: 'New hire onboarding completed for D. Okafor', time: '1h ago', tag: 'Onboarding', color: 'purple' },
                      { text: 'Payroll run PR-2026-06 locked for EMEA', time: '3h ago', tag: 'Payroll', color: 'amber' },
                      { text: 'Org unit "Growth Marketing" created', time: '5h ago', tag: 'Org', color: 'indigo' },
                      { text: 'Compliance policy updated: Germany', time: 'Yesterday', tag: 'Governance', color: 'rose' },
                    ].map((act, i) => (
                      <div key={i} className="flex relative z-10 group cursor-pointer">
                        <div className={`w-6 h-6 rounded-full bg-white border-2 ${dotBorder[act.color]} flex items-center justify-center shrink-0 mr-4 mt-0.5 shadow-sm`}>
                          <div className={`w-2 h-2 rounded-full ${dotBg[act.color]}`} />
                        </div>
                        <div>
                          <p className="text-sm text-slate-700 font-medium leading-snug group-hover:text-indigo-600 transition-colors">{act.text}</p>
                          <div className="flex items-center mt-1 space-x-2 text-xs">
                            <span className="text-slate-400">{act.time}</span>
                            <span className="text-slate-300">•</span>
                            <span className={`${tagText[act.color]} font-medium`}>{act.tag}</span>
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
