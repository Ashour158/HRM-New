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
  Bell,
  Menu,
  MoreHorizontal,
  ChevronRight,
  Grid,
  CheckCircle2,
  FileText
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function Bento() {
  return (
    <div className="min-h-screen bg-[#F2F1EC] text-slate-900 font-['Plus_Jakarta_Sans',sans-serif] flex overflow-hidden">
      <style dangerouslySetInlineStyle={{
        __html: `
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
          
          .bento-hover {
            transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
          }
          .bento-hover:hover {
            transform: translateY(-4px);
            box-shadow: 0 20px 40px -12px rgba(0,0,0,0.08);
          }
          
          /* Custom scrollbar for the dashboard */
          ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          ::-webkit-scrollbar-track {
            background: transparent;
          }
          ::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
        `
      }} />

      {/* Sidebar */}
      <aside className="w-20 lg:w-64 bg-white border-r border-slate-200 flex flex-col justify-between py-6 px-4 shrink-0 z-10 hidden md:flex sticky top-0 h-screen">
        <div>
          <div className="flex items-center gap-3 px-2 mb-10">
            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-white shrink-0">
              <Network size={18} />
            </div>
            <span className="font-bold text-xl tracking-tight hidden lg:block">Lumina</span>
          </div>

          <nav className="flex flex-col gap-2">
            <SidebarItem icon={<Grid size={20} />} label="Overview" active />
            <SidebarItem icon={<Users size={20} />} label="Organization" />
            <SidebarItem icon={<FolderOpen size={20} />} label="Employees" />
            <SidebarItem icon={<Calendar size={20} />} label="Time & Leave" />
            <SidebarItem icon={<Wallet size={20} />} label="Payroll" />
            <SidebarItem icon={<ShieldCheck size={20} />} label="Governance" />
          </nav>
        </div>

        <div className="flex items-center gap-3 px-2 mt-auto">
          <Avatar className="w-10 h-10 border-2 border-slate-100">
            <AvatarFallback className="bg-blue-100 text-blue-700 font-bold">JD</AvatarFallback>
          </Avatar>
          <div className="hidden lg:block overflow-hidden">
            <p className="text-sm font-bold truncate">Jane Doe</p>
            <p className="text-xs text-slate-500 truncate">HR Director</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-screen overflow-y-auto">
        {/* Top Header */}
        <header className="sticky top-0 z-10 bg-[#F2F1EC]/80 backdrop-blur-md px-6 lg:px-10 py-5 flex items-center justify-between border-b border-slate-200/50">
          <div className="flex items-center gap-4 flex-1">
            <button className="md:hidden p-2 -ml-2 rounded-full hover:bg-slate-200/50">
              <Menu size={24} />
            </button>
            <div className="relative max-w-md w-full hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search employees, policies, or reports..." 
                className="w-full bg-white border-none rounded-full py-2.5 pl-10 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2.5 bg-white rounded-full hover:bg-slate-50 shadow-sm transition-colors">
              <Bell size={20} className="text-slate-700" />
              <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
            </button>
            <Button className="bg-slate-900 text-white hover:bg-slate-800 rounded-full px-6 font-semibold shadow-md hidden sm:flex">
              Module Catalog
            </Button>
          </div>
        </header>

        <div className="px-6 lg:px-10 py-8 max-w-7xl mx-auto space-y-8">
          
          {/* Page Header */}
          <div className="max-w-3xl">
            <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight mb-3 text-slate-900">Overview</h1>
            <p className="text-lg text-slate-600 font-medium leading-relaxed">
              One HCM workspace for organization setup, employee self-service, workforce policy, payroll, and governance.
            </p>
          </div>

          {/* Quick Links */}
          <div className="flex items-center gap-3 overflow-x-auto pb-2 -mx-6 px-6 lg:mx-0 lg:px-0 hide-scrollbar">
            {["Module Workbench", "Organization", "Employees", "Service Delivery", "Attendance", "Leave", "Payroll", "Country Policy"].map((link) => (
              <button key={link} className="whitespace-nowrap px-4 py-2 bg-white rounded-full text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm border border-slate-100 hover:border-slate-200 transition-all flex items-center gap-2">
                {link}
              </button>
            ))}
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 auto-rows-[auto]">
            
            {/* KPI 1 */}
            <div className="bg-[#4F46E5] text-white rounded-[2rem] p-6 bento-hover flex flex-col justify-between h-[180px] shadow-lg shadow-indigo-500/20 relative overflow-hidden group">
              <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
              <div className="flex justify-between items-start relative z-10">
                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                  <Users size={24} className="text-white" />
                </div>
                <ArrowRight size={20} className="text-indigo-200" />
              </div>
              <div className="relative z-10">
                <div className="text-4xl font-extrabold mb-1">4,820</div>
                <div className="text-indigo-100 text-sm font-medium flex items-center gap-2">
                  Total Headcount
                  <span className="inline-flex w-1 h-1 rounded-full bg-indigo-300"></span>
                  <span className="text-indigo-200 text-xs">Current active</span>
                </div>
              </div>
            </div>

            {/* KPI 2 */}
            <div className="bg-[#0D9488] text-white rounded-[2rem] p-6 bento-hover flex flex-col justify-between h-[180px] shadow-lg shadow-teal-500/20 relative overflow-hidden group">
              <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
              <div className="flex justify-between items-start relative z-10">
                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                  <TrendingDown size={24} className="text-white" />
                </div>
                <div className="px-2.5 py-1 bg-teal-800/40 rounded-full text-xs font-bold text-teal-100 backdrop-blur-sm">
                  -1.2%
                </div>
              </div>
              <div className="relative z-10">
                <div className="text-4xl font-extrabold mb-1">8.4%</div>
                <div className="text-teal-100 text-sm font-medium flex items-center gap-2">
                  Turnover Rate
                  <span className="inline-flex w-1 h-1 rounded-full bg-teal-300"></span>
                  <span className="text-teal-200 text-xs">Annualized</span>
                </div>
              </div>
            </div>

            {/* KPI 3 */}
            <div className="bg-[#EA580C] text-white rounded-[2rem] p-6 bento-hover flex flex-col justify-between h-[180px] shadow-lg shadow-orange-500/20 relative overflow-hidden group">
              <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
              <div className="flex justify-between items-start relative z-10">
                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                  <Briefcase size={24} className="text-white" />
                </div>
                <ArrowRight size={20} className="text-orange-200" />
              </div>
              <div className="relative z-10">
                <div className="text-4xl font-extrabold mb-1">137</div>
                <div className="text-orange-100 text-sm font-medium flex items-center gap-2">
                  Open Positions
                  <span className="inline-flex w-1 h-1 rounded-full bg-orange-300"></span>
                  <span className="text-orange-200 text-xs">Demand</span>
                </div>
              </div>
            </div>

            {/* KPI 4 */}
            <div className="bg-[#DB2777] text-white rounded-[2rem] p-6 bento-hover flex flex-col justify-between h-[180px] shadow-lg shadow-pink-500/20 relative overflow-hidden group">
              <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
              <div className="flex justify-between items-start relative z-10">
                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                  <UserPlus size={24} className="text-white" />
                </div>
                <ArrowRight size={20} className="text-pink-200" />
              </div>
              <div className="relative z-10">
                <div className="text-4xl font-extrabold mb-1">92</div>
                <div className="text-pink-100 text-sm font-medium flex items-center gap-2">
                  New Hires MTD
                  <span className="inline-flex w-1 h-1 rounded-full bg-pink-300"></span>
                  <span className="text-pink-200 text-xs">Volume</span>
                </div>
              </div>
            </div>

            {/* Operating Flow - Span 2 cols */}
            <div className="xl:col-span-2 xl:row-span-2 bg-white rounded-[2rem] p-8 shadow-sm flex flex-col h-full border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Network className="text-blue-500" />
                  One HCM Operating Flow
                </h2>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <MoreHorizontal className="text-slate-400" />
                </Button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                <ModuleCard 
                  icon={<Network className="text-indigo-600" size={20} />} 
                  title="People & Organization" 
                  desc="Legal entities, departments, org units, positions, and manager lines."
                  color="bg-indigo-50"
                />
                <ModuleCard 
                  icon={<FolderOpen className="text-amber-600" size={20} />} 
                  title="Employee Records" 
                  desc="Worker profiles power self-service, payroll, and approvals."
                  color="bg-amber-50"
                />
                <ModuleCard 
                  icon={<Calendar className="text-emerald-600" size={20} />} 
                  title="Leave & Attendance" 
                  desc="Policy-driven leave balances, approval queues, shifts, and attendance."
                  color="bg-emerald-50"
                />
                <ModuleCard 
                  icon={<Wallet className="text-sky-600" size={20} />} 
                  title="Payroll & Reward" 
                  desc="Payroll operations consume attendance, leave, worker, and benefits data."
                  color="bg-sky-50"
                />
                <ModuleCard 
                  icon={<ShieldCheck className="text-rose-600" size={20} />} 
                  title="Governance" 
                  desc="Country policy, compliance controls, allowed actions, and audit readiness."
                  color="bg-rose-50"
                />
                <ModuleCard 
                  icon={<Eye className="text-violet-600" size={20} />} 
                  title="Employee Mode" 
                  desc="Switch personas to verify the self-service experience."
                  color="bg-violet-50"
                  highlight
                />
              </div>
            </div>

            {/* Alerts Panel */}
            <div className="xl:col-span-1 xl:row-span-2 bg-white rounded-[2rem] p-8 shadow-sm flex flex-col h-full border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <AlertTriangle className="text-orange-500" />
                  Attention Required
                </h2>
                <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2.5 py-1 rounded-full">4</span>
              </div>
              
              <div className="space-y-4 flex-1">
                <AlertItem 
                  severity="high" 
                  title="23 work permits expire within 30 days" 
                  time="Urgent"
                />
                <AlertItem 
                  severity="medium" 
                  title="Payroll cutoff for APAC region is in 2 days" 
                  time="Upcoming"
                />
                <AlertItem 
                  severity="medium" 
                  title="14 performance reviews overdue" 
                  time="Overdue"
                />
                <AlertItem 
                  severity="low" 
                  title="Q3 org chart pending manager sign-off" 
                  time="Pending"
                />
              </div>
              <Button variant="outline" className="w-full mt-6 rounded-xl font-semibold border-slate-200 text-slate-700">
                View All Alerts
              </Button>
            </div>

            {/* Recent Activity */}
            <div className="xl:col-span-1 xl:row-span-2 bg-[#1e293b] text-white rounded-[2rem] p-8 shadow-sm flex flex-col h-full relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-slate-700/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              
              <div className="flex items-center justify-between mb-6 relative z-10">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Clock className="text-slate-400" />
                  Recent Activity
                </h2>
              </div>

              <div className="space-y-6 flex-1 relative z-10 mt-2">
                <ActivityItem 
                  icon={<CheckCircle2 className="text-emerald-400" size={16} />}
                  title="Maria Santos approved 4 leave requests"
                  time="12m ago"
                  tag="Leave"
                  tagColor="bg-emerald-400/20 text-emerald-300"
                />
                <ActivityItem 
                  icon={<UserPlus className="text-pink-400" size={16} />}
                  title="New hire onboarding completed for D. Okafor"
                  time="1h ago"
                  tag="Onboarding"
                  tagColor="bg-pink-400/20 text-pink-300"
                />
                <ActivityItem 
                  icon={<Wallet className="text-sky-400" size={16} />}
                  title="Payroll run PR-2026-06 locked for EMEA"
                  time="3h ago"
                  tag="Payroll"
                  tagColor="bg-sky-400/20 text-sky-300"
                />
                <ActivityItem 
                  icon={<Network className="text-indigo-400" size={16} />}
                  title="Org unit 'Growth Marketing' created"
                  time="5h ago"
                  tag="Org"
                  tagColor="bg-indigo-400/20 text-indigo-300"
                />
                <ActivityItem 
                  icon={<FileText className="text-amber-400" size={16} />}
                  title="Compliance policy updated: Germany"
                  time="Yesterday"
                  tag="Governance"
                  tagColor="bg-amber-400/20 text-amber-300"
                />
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

// --- Subcomponents ---

function SidebarItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <button className={`flex items-center gap-3 px-3 py-3 rounded-2xl transition-all ${active ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}>
      <span className={active ? 'text-white' : 'text-slate-400'}>{icon}</span>
      <span className="font-semibold text-sm hidden lg:block">{label}</span>
    </button>
  );
}

function ModuleCard({ icon, title, desc, color, highlight = false }: { icon: React.ReactNode, title: string, desc: string, color: string, highlight?: boolean }) {
  return (
    <div className={`p-4 rounded-[1.25rem] border ${highlight ? 'border-violet-200 bg-violet-50/50' : 'border-slate-100 bg-white'} hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer group flex flex-col`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
        <h3 className="font-bold text-slate-900 leading-tight">{title}</h3>
      </div>
      <p className="text-sm text-slate-500 font-medium leading-relaxed mt-auto">{desc}</p>
    </div>
  );
}

function AlertItem({ severity, title, time }: { severity: 'high' | 'medium' | 'low', title: string, time: string }) {
  const colors = {
    high: 'bg-red-500',
    medium: 'bg-orange-500',
    low: 'bg-blue-500'
  };
  const bgColors = {
    high: 'bg-red-50 hover:bg-red-100',
    medium: 'bg-orange-50 hover:bg-orange-100',
    low: 'bg-blue-50 hover:bg-blue-100'
  };

  return (
    <div className={`flex items-start gap-4 p-4 rounded-[1.25rem] transition-colors cursor-pointer border border-transparent ${bgColors[severity]}`}>
      <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 shadow-sm ${colors[severity]}`} />
      <div className="flex-1">
        <p className="text-sm font-bold text-slate-900 mb-1 leading-snug">{title}</p>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{time}</p>
      </div>
      <ChevronRight size={16} className="text-slate-400 mt-1 shrink-0" />
    </div>
  );
}

function ActivityItem({ icon, title, time, tag, tagColor }: { icon: React.ReactNode, title: string, time: string, tag: string, tagColor: string }) {
  return (
    <div className="relative pl-6 pb-2 last:pb-0">
      <div className="absolute left-[11px] top-6 bottom-0 w-px bg-slate-700/50 last:hidden" />
      <div className="absolute left-0 top-1.5 w-[22px] h-[22px] rounded-full bg-slate-800 flex items-center justify-center ring-4 ring-[#1e293b] z-10">
        {icon}
      </div>
      <div className="ml-3">
        <p className="text-sm font-semibold text-slate-200 mb-1.5 leading-snug">{title}</p>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${tagColor}`}>
            {tag}
          </span>
          <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-slate-600 inline-block"></span>
            {time}
          </span>
        </div>
      </div>
    </div>
  );
}
