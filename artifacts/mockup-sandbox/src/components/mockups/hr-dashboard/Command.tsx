import React, { useState } from 'react';
import { 
  Users, Activity, UserPlus, Briefcase, FileText, Calendar, 
  DollarSign, ShieldCheck, MonitorPlay, Search, Bell, Menu, 
  ChevronRight, ArrowUpRight, ArrowDownRight, Clock, 
  CheckCircle2, AlertTriangle, Info, Network, Settings, 
  LogOut, LayoutGrid, Zap, Sparkles
} from 'lucide-react';

// --- MOCK DATA ---
const KPIs = [
  { title: "Total Headcount", value: "4,820", helper: "Current active workforce", trend: "+12", trendUp: true, color: "cyan" },
  { title: "Turnover Rate", value: "8.4%", helper: "Annualized movement", trend: "-1.2%", trendUp: true, color: "magenta" },
  { title: "Open Positions", value: "137", helper: "Recruiting & workforce demand", trend: "+5", trendUp: false, color: "lime" },
  { title: "New Hires MTD", value: "92", helper: "Month-to-date onboarding volume", trend: "+18", trendUp: true, color: "amber" },
];

const MODULES = [
  { title: "People & Organization", desc: "Legal entities, departments, org units, positions, and manager lines.", icon: Network, color: "cyan" },
  { title: "Employee Records", desc: "Worker profiles power self-service, payroll, and approvals.", icon: FileText, color: "magenta" },
  { title: "Leave & Attendance", desc: "Policy-driven leave balances, approval queues, shifts, and attendance.", icon: Calendar, color: "lime" },
  { title: "Payroll & Reward", desc: "Payroll operations consume attendance, leave, worker, and benefits data.", icon: DollarSign, color: "amber" },
  { title: "Governance", desc: "Country policy, compliance controls, allowed actions, and audit readiness.", icon: ShieldCheck, color: "violet" },
  { title: "Employee Mode Preview", desc: "Switch personas to verify the self-service experience.", icon: MonitorPlay, color: "rose" },
];

const ALERTS = [
  { id: 1, text: "23 work permits expire within 30 days", severity: "high" },
  { id: 2, text: "Payroll cutoff for APAC region is in 2 days", severity: "medium" },
  { id: 3, text: "14 performance reviews overdue", severity: "medium" },
  { id: 4, text: "Q3 org chart pending manager sign-off", severity: "low" },
];

const ACTIVITIES = [
  { id: 1, text: "Maria Santos approved 4 leave requests", time: "12m ago", type: "Leave", color: "lime" },
  { id: 2, text: "New hire onboarding completed for D. Okafor", time: "1h ago", type: "Onboarding", color: "amber" },
  { id: 3, text: "Payroll run PR-2026-06 locked for EMEA", time: "3h ago", type: "Payroll", color: "magenta" },
  { id: 4, text: "Org unit 'Growth Marketing' created", time: "5h ago", type: "Org", color: "cyan" },
  { id: 5, text: "Compliance policy updated: Germany", time: "Yesterday", type: "Governance", color: "violet" },
];

const QUICK_LINKS = [
  "Module Workbench", "Organization", "Employees", "Service Delivery", 
  "Attendance", "Leave", "Payroll", "Country Policy"
];

// --- HELPER COMPONENTS ---

const NeonGlow = ({ color, className = "" }: { color: string, className?: string }) => {
  const colorMap: Record<string, string> = {
    cyan: "bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.8)]",
    magenta: "bg-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.8)]",
    lime: "bg-lime-400 shadow-[0_0_15px_rgba(163,230,53,0.8)]",
    amber: "bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.8)]",
    violet: "bg-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.8)]",
    rose: "bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.8)]",
  };
  return <div className={`w-2 h-2 rounded-full ${colorMap[color] || colorMap.cyan} ${className}`} />;
};

const CardBorder = ({ children, color, className = "" }: { children: React.ReactNode, color: string, className?: string }) => {
  const borderMap: Record<string, string> = {
    cyan: "hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]",
    magenta: "hover:border-fuchsia-500/50 hover:shadow-[0_0_20px_rgba(217,70,239,0.15)]",
    lime: "hover:border-lime-500/50 hover:shadow-[0_0_20px_rgba(163,230,53,0.15)]",
    amber: "hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]",
    violet: "hover:border-violet-500/50 hover:shadow-[0_0_20px_rgba(139,92,246,0.15)]",
    rose: "hover:border-rose-500/50 hover:shadow-[0_0_20px_rgba(244,63,94,0.15)]",
  };
  
  return (
    <div className={`relative bg-[#0b0e17] border border-slate-800 rounded-xl overflow-hidden transition-all duration-300 ${borderMap[color]} ${className}`}>
      {children}
    </div>
  );
}

export function Command() {
  return (
    <div className="min-h-screen bg-[#030409] text-slate-300 font-sans selection:bg-cyan-500/30 overflow-hidden flex"
         style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
      
      {/* Import Font */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
        
        .neon-text-cyan { text-shadow: 0 0 10px rgba(34, 211, 238, 0.5); }
        .neon-text-magenta { text-shadow: 0 0 10px rgba(232, 121, 249, 0.5); }
        .neon-text-lime { text-shadow: 0 0 10px rgba(163, 230, 53, 0.5); }
        .neon-text-amber { text-shadow: 0 0 10px rgba(251, 191, 36, 0.5); }
        
        /* Custom scrollbar */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #030409; }
        ::-webkit-scrollbar-thumb { background: #1f2937; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #374151; }
      `}} />

      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-[#06080e] flex flex-col shrink-0 z-20 hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-xl tracking-tight neon-text-cyan">
            <Sparkles className="w-5 h-5" />
            LUMINA<span className="text-slate-500 font-light text-shadow-none">HR</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-4 px-2">Core Platform</div>
          
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[inset_0_0_10px_rgba(6,182,212,0.1)]">
            <LayoutGrid className="w-4 h-4" />
            <span className="font-medium">Overview</span>
          </a>
          
          {[
            { icon: Network, label: "Organization" },
            { icon: Users, label: "Employees" },
            { icon: Calendar, label: "Time & Leave" },
            { icon: DollarSign, label: "Payroll" },
            { icon: ShieldCheck, label: "Compliance" },
          ].map((item, i) => (
            <a key={i} href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors">
              <item.icon className="w-4 h-4 opacity-70" />
              <span>{item.label}</span>
            </a>
          ))}
        </div>
        
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-800">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-fuchsia-500 p-[1px]">
              <div className="w-full h-full rounded-full bg-[#0b0e17] flex items-center justify-center text-xs font-bold text-slate-200">
                AD
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-200 truncate">Admin User</div>
              <div className="text-xs text-slate-500 truncate">Global HR Lead</div>
            </div>
            <Settings className="w-4 h-4 text-slate-500 hover:text-cyan-400 cursor-pointer" />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative">
        
        {/* Background glow effects */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[30%] bg-cyan-900/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-[20%] right-[-10%] w-[30%] h-[40%] bg-fuchsia-900/10 blur-[120px] rounded-full pointer-events-none" />
        
        {/* Top Navbar */}
        <header className="h-16 flex items-center justify-between px-8 border-b border-slate-800 bg-[#06080e]/80 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-4">
            <button className="md:hidden text-slate-400 hover:text-slate-200">
              <Menu className="w-5 h-5" />
            </button>
            <div className="relative group">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
              <input 
                type="text" 
                placeholder="Command menu (Cmd+K)..." 
                className="w-64 sm:w-96 bg-slate-900/50 border border-slate-800 rounded-full pl-9 pr-4 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all placeholder:text-slate-600"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-slate-400 hover:text-cyan-400 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
            </button>
            <button className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-full border border-slate-800 hover:border-slate-700 bg-slate-900/50 transition-colors">
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 z-10">
          <div className="max-w-7xl mx-auto space-y-8">
            
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                  Overview
                  <div className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_5px_#00f0ff] animate-pulse" />
                    Live System
                  </div>
                </h1>
                <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
                  One HCM workspace for organization setup, employee self-service, workforce policy, payroll, and governance.
                </p>
              </div>
              <button className="shrink-0 bg-slate-100 hover:bg-white text-slate-900 px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-[0_0_15px_rgba(255,255,255,0.15)] transition-all">
                <Zap className="w-4 h-4" />
                Module Catalog
              </button>
            </div>

            {/* Quick Links Row */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mr-2">Quick Actions:</span>
              {QUICK_LINKS.map((link, i) => (
                <button key={i} className="text-xs px-3 py-1.5 rounded-full bg-[#0b0e17] border border-slate-800 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/30 transition-colors">
                  {link}
                </button>
              ))}
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {KPIs.map((kpi, i) => (
                <CardBorder key={i} color={kpi.color} className="p-5 flex flex-col justify-between group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-sm font-medium text-slate-400">{kpi.title}</div>
                    <NeonGlow color={kpi.color} />
                  </div>
                  
                  <div>
                    <div className="flex items-baseline gap-3 mb-1">
                      <div className={`text-4xl font-bold text-white neon-text-${kpi.color}`}>
                        {kpi.value}
                      </div>
                      <div className={`flex items-center text-xs font-medium ${kpi.trendUp ? 'text-lime-400' : 'text-rose-400'}`}>
                        {kpi.trendUp ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                        {kpi.trend}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">{kpi.helper}</div>
                  </div>
                  
                  {/* Decorative glowing bottom line on hover */}
                  <div className={`absolute bottom-0 left-0 h-0.5 w-0 group-hover:w-full transition-all duration-500 bg-gradient-to-r from-transparent via-${kpi.color}-500 to-transparent opacity-50`} />
                </CardBorder>
              ))}
            </div>

            {/* Main Grid: Modules & Sidebar panels */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              
              {/* Left Column: Operating Flow (Spans 2 cols on wide screens) */}
              <div className="xl:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                    One HCM Operating Flow
                  </h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {MODULES.map((mod, i) => {
                    const Icon = mod.icon;
                    return (
                      <CardBorder key={i} color={mod.color} className="p-5 flex gap-4 group cursor-pointer">
                        <div className={`w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 group-hover:border-${mod.color}-500/50 transition-colors`}>
                          <Icon className={`w-6 h-6 text-${mod.color}-400 drop-shadow-[0_0_5px_currentColor]`} />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-base font-semibold text-slate-200 mb-1 group-hover:text-white transition-colors">
                            {mod.title}
                          </h3>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            {mod.desc}
                          </p>
                        </div>
                        <div className="flex items-center text-slate-600 group-hover:text-cyan-400 transition-colors opacity-0 group-hover:opacity-100">
                          <ChevronRight className="w-5 h-5" />
                        </div>
                      </CardBorder>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Alerts & Activity */}
              <div className="space-y-6">
                
                {/* Alerts Panel */}
                <div className="bg-[#0b0e17] border border-slate-800 rounded-xl overflow-hidden flex flex-col">
                  <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/20">
                    <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Attention Required
                    </h2>
                    <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-medium">4</span>
                  </div>
                  <div className="p-2">
                    {ALERTS.map((alert) => (
                      <div key={alert.id} className="flex items-start gap-3 p-3 hover:bg-slate-800/30 rounded-lg transition-colors cursor-pointer group">
                        <div className="mt-1">
                          <NeonGlow color={
                            alert.severity === 'high' ? 'rose' : 
                            alert.severity === 'medium' ? 'amber' : 'cyan'
                          } />
                        </div>
                        <p className="text-sm text-slate-300 group-hover:text-white flex-1">{alert.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Activity Feed */}
                <div className="bg-[#0b0e17] border border-slate-800 rounded-xl overflow-hidden flex flex-col flex-1">
                  <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/20">
                    <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-cyan-500" />
                      Recent Activity
                    </h2>
                  </div>
                  <div className="p-5 space-y-6 relative before:absolute before:inset-0 before:ml-[1.4rem] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-800 before:to-transparent">
                    {ACTIVITIES.map((act, i) => (
                      <div key={act.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group cursor-default">
                        {/* Timeline dot */}
                        <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-[#0b0e17] bg-slate-800 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-[0_0_0_2px_#0b0e17] z-10 absolute left-0 md:left-1/2 md:-ml-3 transition-colors group-hover:bg-slate-700">
                           <div className={`w-1.5 h-1.5 rounded-full bg-${act.color}-400 shadow-[0_0_5px_currentColor]`} />
                        </div>
                        
                        {/* Content */}
                        <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] ml-8 md:ml-0 p-3 rounded-lg border border-slate-800/50 bg-slate-900/20 group-hover:border-slate-700 group-hover:bg-slate-800/40 transition-all">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-[10px] font-bold uppercase tracking-wider text-${act.color}-400 bg-${act.color}-500/10 px-1.5 py-0.5 rounded border border-${act.color}-500/20`}>
                              {act.type}
                            </span>
                            <span className="text-[10px] text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {act.time}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-snug">
                            {act.text}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="p-3 text-xs font-medium text-slate-400 hover:text-cyan-400 hover:bg-slate-800/30 transition-colors border-t border-slate-800 text-center w-full">
                    View Complete Audit Log
                  </button>
                </div>
                
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
