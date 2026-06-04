import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  CircleDollarSign,
  Gauge,
  Layers3,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { commercialModules, moduleCategories, type CommercialModule, type CommercialModuleMaturity } from '@/lib/commercial-modules';

const categoryIcons: Record<CommercialModule['category'], React.ComponentType<{ className?: string }>> = {
  'Core HR': Users,
  Workforce: CalendarCheck,
  'Payroll & Reward': CircleDollarSign,
  Talent: Sparkles,
  Compliance: ShieldCheck,
  Operations: Briefcase,
};

const maturityLabels: Record<CommercialModuleMaturity, { label: string; tone: string; description: string }> = {
  'native-ui': {
    label: 'Native UI',
    tone: 'border-[#10b981]/30 bg-[#10b981]/10 text-[#006c49]',
    description: 'Has a dedicated product page or employee/admin experience.',
  },
  workbench: {
    label: 'Workspace',
    tone: 'border-[#4648d4]/30 bg-[#4648d4]/10 text-[#4648d4]',
    description: 'Has a native operations workspace and shared module workbench.',
  },
  'api-ready': {
    label: 'API Ready',
    tone: 'border-[#e29100]/30 bg-[#ffddb8]/65 text-[#653e00]',
    description: 'Backend workflows exist and need a dedicated product UI.',
  },
};

function moduleMatches(module: CommercialModule, search: string, category: string) {
  const haystack = [
    module.label,
    module.summary,
    module.category,
    module.backendRoot,
    ...module.personas,
    ...module.builtCapabilities,
    ...module.keyWorkflows,
    ...module.dataObjects,
  ].join(' ').toLowerCase();

  return (!category || module.category === category) && haystack.includes(search.toLowerCase());
}

function StatBlock({ label, value, icon: Icon }: { label: string; value: number | string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex min-h-[88px] items-center gap-3 border-b border-[#bbcabf]/50 px-4 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#10b981]/10 text-[#006c49]">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="lumina-label">{label}</p>
        <p className="mt-1 font-headline text-2xl font-bold text-[#0b1c30]">{value}</p>
      </div>
    </div>
  );
}

function ModuleCard({ module }: { module: CommercialModule }) {
  const Icon = categoryIcons[module.category];
  const maturity = maturityLabels[module.maturity];

  return (
    <Card className="group relative overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:border-[#10b981]/60 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
      <div className="lumina-accent-strip" />
      <CardHeader className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#006c49] text-white">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg leading-tight">{module.label}</CardTitle>
              <Badge variant="outline" className={cn('rounded-full border px-2 py-1 font-mono text-[11px] uppercase tracking-wider', maturity.tone)}>
                {maturity.label}
              </Badge>
            </div>
            <p className="mt-1 text-xs font-semibold text-[#006c49]">{module.category} / {module.backendRoot}</p>
          </div>
        </div>
        <p className="min-h-[4.5rem] text-sm leading-6 text-[#3c4a42]">{module.summary}</p>
      </CardHeader>
      <CardContent className="space-y-4 p-5 pt-0">
        <div className="space-y-2">
          <p className="lumina-label">Built capabilities</p>
          <div className="flex flex-wrap gap-2">
            {module.builtCapabilities.slice(0, 4).map((capability) => (
              <span key={capability} className="rounded-md border border-[#bbcabf]/70 bg-[#eff4ff] px-2 py-1 text-xs font-medium text-[#3c4a42]">
                {capability}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-[#bbcabf]/40 pt-4">
          <Button asChild size="sm">
              <Link to={`/admin/modules/${module.id}`}>Open Workbench</Link>
            </Button>
          {module.nativePath ? (
            <Button asChild size="sm" variant="outline">
              <Link to={module.nativePath}>Open Workspace</Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminModuleCatalog() {
  const [search, setSearch] = React.useState('');
  const [category, setCategory] = React.useState('');

  const filteredModules = React.useMemo(
    () => commercialModules.filter((module) => moduleMatches(module, search, category)),
    [category, search],
  );

  const nativeCount = commercialModules.filter((module) => module.maturity === 'native-ui').length;
  const workbenchCount = commercialModules.filter((module) => module.maturity === 'workbench').length;
  const apiReadyCount = commercialModules.filter((module) => module.maturity === 'api-ready').length;

  return (
    <div className="min-h-full bg-[#f8f9ff]">
      <div className="lumina-canvas space-y-6">
        <section className="lumina-panel overflow-hidden">
          <div className="grid gap-5 border-b border-[#bbcabf] bg-[#006c49] p-6 text-white lg:grid-cols-[1fr_auto]">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[#6ffbbe]">Commercialization Command Center</p>
              <h2 className="mt-2 font-headline text-3xl font-bold">All Built HR Modules</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/85">
                Every backend HR domain is now exposed in the product UI with clear module status, real data objects, personas, workflows, and a workbench path for API-ready areas.
              </p>
            </div>
            <Button asChild className="w-fit self-end bg-white text-[#006c49] hover:bg-[#eff4ff]">
              <Link to="/admin/system-console/settings">
                <Gauge className="mr-2 h-4 w-4" />
                Admin Setup
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 border-b border-[#bbcabf]/60 bg-white p-4 lg:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6c7a71]" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search modules, workflows, objects, or backend routes"
                className="h-11 pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant={!category ? 'default' : 'outline'} onClick={() => setCategory('')}>
                All
              </Button>
              {moduleCategories.map((item) => (
                <Button
                  key={item}
                  type="button"
                  size="sm"
                  variant={category === item ? 'default' : 'outline'}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid bg-white sm:grid-cols-2 xl:grid-cols-4">
            <StatBlock label="Total Modules" value={commercialModules.length} icon={Layers3} />
            <StatBlock label="Native UI" value={nativeCount} icon={CheckCircle2} />
            <StatBlock label="Workbench" value={workbenchCount} icon={Activity} />
            <StatBlock label="API Ready" value={apiReadyCount} icon={BarChart3} />
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredModules.map((module) => (
            <ModuleCard key={module.id} module={module} />
          ))}
        </section>

        {filteredModules.length === 0 ? (
          <div className="lumina-panel p-8 text-center text-sm text-[#3c4a42]">
            No modules match this search.
          </div>
        ) : null}
      </div>
    </div>
  );
}
