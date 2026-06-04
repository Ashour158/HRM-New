import React from 'react';
import { 
  BarChart, 
  Users, 
  UserPlus, 
  UserMinus, 
  Briefcase, 
  Layers, 
  FileText, 
  CalendarClock, 
  BadgeDollarSign, 
  ShieldCheck, 
  Glasses, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Settings,
  Search,
  Bell,
  Menu,
  Home,
  LayoutDashboard,
  Zap,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function BrutPop() {
  return (
    <div className="min-h-screen bg-[#F4F4F0] text-black font-['Space_Mono',_monospace] flex flex-col md:flex-row selection:bg-pink-400 selection:text-black">
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />

      {/* Sidebar */}
      <aside className="w-full md:w-64 border-b-4 md:border-b-0 md:border-r-4 border-black bg-[#E2F0B6] flex flex-col z-20">
        <div className="p-6 border-b-4 border-black bg-[#FFD166]">
          <h1 className="font-['Bricolage_Grotesque',_sans-serif] font-black text-3xl tracking-tight uppercase flex items-center gap-2">
            <Zap className="fill-black" size={28} />
            Lumina HR
          </h1>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
          <nav className="space-y-2">
            {[
              { icon: LayoutDashboard, label: 'Overview', active: true },
              { icon: Users, label: 'Organization' },
              { icon: FileText, label: 'Employees' },
              { icon: CalendarClock, label: 'Leave' },
              { icon: BadgeDollarSign, label: 'Payroll' },
              { icon: ShieldCheck, label: 'Governance' },
            ].map((item, i) => (
              <a 
                key={i}
                href="#" 
                className={`flex items-center gap-3 px-4 py-3 border-2 border-black rounded-sm font-bold text-sm transition-all duration-200 ${
                  item.active 
                    ? 'bg-black text-white shadow-[4px_4px_0px_0px_#FF6B6B]' 
                    : 'bg-white hover:bg-[#FFD166] hover:shadow-[4px_4px_0px_0px_#000000]'
                }`}
              >
                <item.icon size={20} className={item.active ? 'text-[#FFD166]' : ''} />
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t-4 border-black bg-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full border-2 border-black overflow-hidden bg-[#4ECDC4] flex items-center justify-center">
              <span className="font-black text-xl">JD</span>
            </div>
            <div>
              <div className="font-bold">Jane Doe</div>
              <div className="text-xs font-bold text-gray-600 uppercase">HR Admin</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Nav */}
        <header className="border-b-4 border-black bg-white p-4 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 z-10">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={20} />
            <input 
              type="text" 
              placeholder="Search people, policies, reports..." 
              className="w-full pl-10 pr-4 py-3 border-4 border-black rounded-none focus:outline-none focus:ring-0 focus:shadow-[4px_4px_0px_0px_#4ECDC4] transition-shadow font-bold bg-[#F8F9FA] placeholder:text-black/50"
            />
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto justify-end">
            <button className="p-3 border-4 border-black bg-[#FFD166] hover:bg-[#FF6B6B] hover:shadow-[4px_4px_0px_0px_#000000] transition-all rounded-none relative">
              <Bell size={24} />
              <span className="absolute -top-2 -right-2 w-6 h-6 bg-[#4ECDC4] border-2 border-black rounded-full flex items-center justify-center font-bold text-xs">3</span>
            </button>
            <button className="p-3 border-4 border-black bg-white hover:bg-black hover:text-white transition-colors rounded-none md:hidden">
              <Menu size={24} />
            </button>
          </div>
        </header>

        <div className="p-4 md:p-8 lg:p-12 space-y-12">
          
          {/* Page Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-[#4ECDC4] p-8 border-4 border-black shadow-[8px_8px_0px_0px_#000000]">
            <div className="max-w-2xl">
              <h2 className="font-['Bricolage_Grotesque',_sans-serif] font-black text-5xl md:text-7xl uppercase mb-4 tracking-tight leading-none">
                Overview
              </h2>
              <p className="text-lg font-bold border-l-4 border-black pl-4">
                One HCM workspace for organization setup, employee self-service, workforce policy, payroll, and governance.
              </p>
            </div>
            <button className="px-6 py-4 bg-white border-4 border-black font-black text-lg uppercase hover:bg-[#FFD166] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#000000] transition-all flex items-center gap-2">
              <Layers />
              Module Catalog
            </button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Total Headcount', value: '4,820', sub: 'Current active workforce', icon: Users, color: 'bg-[#FF6B6B]' },
              { label: 'Turnover Rate', value: '8.4%', sub: 'Annualized movement (↓)', icon: UserMinus, color: 'bg-[#FFD166]' },
              { label: 'Open Positions', value: '137', sub: 'Recruiting & demand', icon: Briefcase, color: 'bg-[#4ECDC4]' },
              { label: 'New Hires MTD', value: '92', sub: 'Month-to-date volume', icon: UserPlus, color: 'bg-[#E2F0B6]' }
            ].map((kpi, i) => (
              <div key={i} className={`p-6 border-4 border-black ${kpi.color} shadow-[6px_6px_0px_0px_#000000] relative overflow-hidden group`}>
                <div className="absolute -right-4 -bottom-4 opacity-20 transform group-hover:scale-110 transition-transform">
                  <kpi.icon size={120} />
                </div>
                <div className="relative z-10">
                  <h3 className="font-black uppercase text-sm mb-2">{kpi.label}</h3>
                  <div className="font-['Bricolage_Grotesque',_sans-serif] font-black text-5xl tracking-tighter mb-4">{kpi.value}</div>
                  <div className="text-xs font-bold border-t-2 border-black/30 pt-2">{kpi.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Main Modules Flow */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center gap-4 mb-2">
                <div className="h-4 w-4 bg-black"></div>
                <h3 className="font-['Bricolage_Grotesque',_sans-serif] font-black text-3xl uppercase">One HCM Operating Flow</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { title: 'People & Organization', desc: 'Legal entities, departments, org units, positions, and manager lines.', icon: Layers, color: 'bg-white' },
                  { title: 'Employee Records', desc: 'Worker profiles power self-service, payroll, and approvals.', icon: FileText, color: 'bg-white' },
                  { title: 'Leave & Attendance', desc: 'Policy-driven leave balances, approval queues, shifts, and attendance.', icon: CalendarClock, color: 'bg-[#FFD166]' },
                  { title: 'Payroll & Reward', desc: 'Payroll operations consume attendance, leave, worker, and benefits data.', icon: BadgeDollarSign, color: 'bg-[#4ECDC4]' },
                  { title: 'Governance', desc: 'Country policy, compliance controls, allowed actions, and audit readiness.', icon: ShieldCheck, color: 'bg-white' },
                  { title: 'Employee Mode', desc: 'Switch personas to verify the self-service experience.', icon: Glasses, color: 'bg-black text-white border-black' }
                ].map((mod, i) => (
                  <button key={i} className={`text-left p-6 border-4 border-black ${mod.color} hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#FF6B6B] transition-all flex flex-col gap-4 group`}>
                    <div className={`p-3 border-2 border-black inline-block ${mod.color === 'bg-black text-white border-black' ? 'bg-white text-black' : 'bg-white'}`}>
                      <mod.icon size={24} />
                    </div>
                    <div>
                      <h4 className="font-black text-xl mb-2 group-hover:underline underline-offset-4">{mod.title}</h4>
                      <p className={`text-sm font-bold leading-tight ${mod.color.includes('bg-black') ? 'text-gray-300' : 'text-gray-700'}`}>{mod.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Quick Links */}
              <div className="mt-12">
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-4 w-4 bg-[#FF6B6B] border-2 border-black"></div>
                  <h3 className="font-['Bricolage_Grotesque',_sans-serif] font-black text-2xl uppercase">Quick Links</h3>
                </div>
                <div className="flex flex-wrap gap-3">
                  {['Module Workbench', 'Organization', 'Employees', 'Service Delivery', 'Attendance', 'Leave', 'Payroll', 'Country Policy'].map((link, i) => (
                    <a key={i} href="#" className="px-4 py-2 bg-white border-2 border-black font-bold text-sm uppercase hover:bg-black hover:text-white hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_#4ECDC4] transition-all inline-flex items-center gap-2">
                      {link}
                      <ArrowRight size={14} />
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar (Alerts & Activity) */}
            <div className="space-y-8">
              
              {/* Alerts */}
              <div className="bg-[#FF6B6B] p-6 border-4 border-black shadow-[6px_6px_0px_0px_#000000]">
                <h3 className="font-['Bricolage_Grotesque',_sans-serif] font-black text-2xl uppercase mb-6 text-white flex items-center gap-2">
                  <AlertTriangle className="fill-black text-white" />
                  Action Required
                </h3>
                
                <div className="space-y-3">
                  {[
                    { text: '23 work permits expire within 30 days', severity: 'high' },
                    { text: 'Payroll cutoff for APAC region is in 2 days', severity: 'med' },
                    { text: '14 performance reviews overdue', severity: 'med' },
                    { text: 'Q3 org chart pending manager sign-off', severity: 'low' }
                  ].map((alert, i) => (
                    <div key={i} className="bg-white p-4 border-2 border-black font-bold text-sm flex gap-3 items-start hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#000000] transition-transform cursor-pointer">
                      <div className={`mt-0.5 w-3 h-3 rounded-full border-2 border-black flex-shrink-0 ${
                        alert.severity === 'high' ? 'bg-red-500' : alert.severity === 'med' ? 'bg-yellow-400' : 'bg-blue-400'
                      }`} />
                      <span>{alert.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white p-6 border-4 border-black shadow-[6px_6px_0px_0px_#000000]">
                <h3 className="font-['Bricolage_Grotesque',_sans-serif] font-black text-2xl uppercase mb-6 flex items-center gap-2">
                  <Clock />
                  Recent Activity
                </h3>
                
                <div className="space-y-0 relative before:absolute before:inset-0 before:ml-[15px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-1 before:bg-black before:z-0">
                  {[
                    { text: 'Maria Santos approved 4 leave requests', time: '12m ago', tag: 'Leave', color: 'bg-[#FFD166]' },
                    { text: 'New hire onboarding completed for D. Okafor', time: '1h ago', tag: 'Onboarding', color: 'bg-[#E2F0B6]' },
                    { text: 'Payroll run PR-2026-06 locked for EMEA', time: '3h ago', tag: 'Payroll', color: 'bg-[#4ECDC4]' },
                    { text: 'Org unit "Growth Marketing" created', time: '5h ago', tag: 'Org', color: 'bg-[#FF6B6B]' },
                    { text: 'Compliance policy updated: Germany', time: 'Yesterday', tag: 'Governance', color: 'bg-white' }
                  ].map((activity, i) => (
                    <div key={i} className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-2 py-4 pl-10 md:pl-0 md:even:flex-row-reverse group">
                      
                      <div className="absolute left-0 md:left-1/2 w-8 h-8 rounded-full bg-white border-4 border-black -translate-x-1/2 flex items-center justify-center group-hover:scale-125 transition-transform z-10">
                        <div className={`w-3 h-3 rounded-full border-2 border-black ${activity.color}`}></div>
                      </div>

                      <div className="md:w-[calc(50%-2rem)] bg-white border-2 border-black p-3 text-sm font-bold shadow-[3px_3px_0px_0px_#000000] w-full">
                        <div className="mb-2 leading-snug">{activity.text}</div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">{activity.time}</span>
                          <span className={`px-2 py-1 border-2 border-black uppercase text-[10px] ${activity.color}`}>{activity.tag}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
