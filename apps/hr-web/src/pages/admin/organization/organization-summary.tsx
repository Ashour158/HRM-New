import { Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OrganizationSetupJourneyTone, OrganizationSetupTab } from '@/lib/organization-setup-journey';

type SetupJourneyStep = {
  actionLabel: string;
  category: string;
  href?: string;
  label: string;
  status: string;
  targetTab?: OrganizationSetupTab;
  tone: OrganizationSetupJourneyTone;
};

const setupToneClasses: Record<OrganizationSetupJourneyTone, string> = {
  attention: 'border-red-200 bg-red-50 text-red-700',
  default: 'border-indigo-100 bg-indigo-50 text-indigo-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-orange-200 bg-orange-50 text-orange-700',
};

export function OrganizationSummaryHeader({
  activeHeadcount,
  assignedWorkerCount,
  legalEntityCount,
  onTabChange,
  orgUnitCount,
  pendingHeadcount,
  setupJourney,
  totalAnnualCost,
  vacancies,
}: {
  activeHeadcount: number;
  assignedWorkerCount: number;
  legalEntityCount: number;
  onTabChange: (tab: OrganizationSetupTab) => void;
  orgUnitCount: number;
  pendingHeadcount: number;
  setupJourney: SetupJourneyStep[];
  totalAnnualCost: string;
  vacancies: number;
}) {
  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-white/60 bg-white/60 py-1 ps-2 pe-3 text-xs font-bold text-slate-600 backdrop-blur-md">
            <span className="relative flex h-2.5 w-2.5">
              <span className="fusion-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            Live org graph
          </div>
          <h2 className="flex items-center gap-2 font-headline text-3xl font-extrabold tracking-tight">
            <Building2 className="h-7 w-7 text-primary" />
            <span className="fusion-gradient-text">Organization Admin</span>
          </h2>
          <p className="mt-2 text-sm text-slate-500">Create legal entities, departments, reporting lines, and employee assignments.</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {setupJourney.map((step, index) => {
          const content = (
            <div className="flex h-full min-h-[138px] flex-col justify-between rounded-[1.5rem] border border-white/70 bg-white/65 p-4 text-start shadow-sm transition-all hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-md">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{index + 1}. {step.category}</p>
                  <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-bold', setupToneClasses[step.tone])}>
                    {step.status}
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-extrabold text-slate-950">{step.label}</h3>
              </div>
              <div className="mt-4 text-sm font-bold text-indigo-600">{step.actionLabel}</div>
            </div>
          );

          if (step.href) {
            return <Link key={step.label} to={step.href} className="group">{content}</Link>;
          }

          return (
            <button
              key={step.label}
              type="button"
              className="group"
              onClick={() => step.targetTab && onTabChange(step.targetTab)}
            >
              {content}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="fusion-hover rounded-[2rem] bg-gradient-to-br from-indigo-500 to-violet-500 p-5 text-white">
          <p className="text-sm font-medium text-white/85">Legal Entities</p>
          <p className="mt-2 text-4xl font-extrabold">{legalEntityCount}</p>
        </div>
        <div className="fusion-hover rounded-[2rem] bg-gradient-to-br from-violet-500 to-purple-500 p-5 text-white">
          <p className="text-sm font-medium text-white/85">Org Units</p>
          <p className="mt-2 text-4xl font-extrabold">{orgUnitCount}</p>
        </div>
        <div className="fusion-hover rounded-[2rem] bg-gradient-to-br from-teal-500 to-emerald-500 p-5 text-white">
          <p className="text-sm font-medium text-white/85">Assigned Workers</p>
          <p className="mt-2 text-4xl font-extrabold">{assignedWorkerCount}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="fusion-glass fusion-hover rounded-[2rem] p-5">
          <p className="text-sm text-muted-foreground">Active Headcount</p>
          <p className="mt-1 text-3xl font-bold">{activeHeadcount}</p>
        </div>
        <div className="fusion-glass fusion-hover rounded-[2rem] p-5">
          <p className="text-sm text-muted-foreground">Vacancies</p>
          <p className="mt-1 text-3xl font-bold">{vacancies}</p>
        </div>
        <div className="fusion-glass fusion-hover rounded-[2rem] p-5">
          <p className="text-sm text-muted-foreground">Pending Demand</p>
          <p className="mt-1 text-3xl font-bold">{pendingHeadcount}</p>
        </div>
        <div className="fusion-glass fusion-hover rounded-[2rem] p-5">
          <p className="text-sm text-muted-foreground">Annual Workforce Cost</p>
          <p className="mt-1 text-3xl font-bold">{totalAnnualCost}</p>
        </div>
      </div>
    </>
  );
}
