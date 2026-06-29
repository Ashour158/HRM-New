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
import { EmptyState } from '@/components/common/empty-state';
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
    label: 'Full Page',
    tone: 'border-secondary/30 bg-secondary/10 text-primary',
    description: 'Has a dedicated product page or employee/admin experience.',
  },
  workbench: {
    label: 'Operations',
    tone: 'border-primary/30 bg-primary/10 text-primary',
    description: 'Has a native operations workspace and shared module workbench.',
  },
  'api-ready': {
    label: 'Setup Needed',
    tone: 'border-warning/30 bg-warning/65 text-warning-foreground',
    description: 'The service is available through an operations workspace until a full page is configured.',
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
    <div className="flex min-h-[88px] items-center gap-3 border-b border-border/50 px-4 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="lumina-label">{label}</p>
        <p className="mt-1 font-headline text-2xl font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function ModuleCard({ module }: { module: CommercialModule }) {
  const Icon = categoryIcons[module.category];
  const maturity = maturityLabels[module.maturity];

  return (
    <Card className="group relative overflow-hidden border-transparent fusion-glass rounded-2xl fusion-hover">
      <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-teal-400" />
      <CardHeader className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary text-white">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg leading-tight">{module.label}</CardTitle>
              <Badge variant="outline" className={cn('rounded-full border px-2 py-1 font-mono text-[11px] uppercase tracking-wider', maturity.tone)}>
                {maturity.label}
              </Badge>
            </div>
            <p className="mt-1 text-xs font-semibold text-primary">{module.category}</p>
          </div>
        </div>
        <p className="min-h-[4.5rem] text-sm leading-6 text-muted-foreground">{module.summary}</p>
      </CardHeader>
      <CardContent className="space-y-4 p-5 pt-0">
        <div className="space-y-2">
          <p className="lumina-label">Built capabilities</p>
          <div className="flex flex-wrap gap-2">
            {module.builtCapabilities.slice(0, 4).map((capability) => (
              <span key={capability} className="rounded-md border border-border/70 bg-accent px-2 py-1 text-xs font-medium text-muted-foreground">
                {capability}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-4">
          <Button asChild size="sm">
              <Link to={`/admin/modules/${module.id}`}>Open Workbench</Link>
            </Button>
          {module.nativePath ? (
            <Button asChild size="sm" variant="outline">
              <Link to={module.nativePath}>Open Operations</Link>
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
    <div className="min-h-full">
      <div className="lumina-canvas space-y-6">
        <section className="fusion-glass rounded-[2rem] overflow-hidden">
          <div className="grid gap-5 bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-500 p-6 text-white lg:grid-cols-[1fr_auto]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Module Catalog</p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  <span className="h-2 w-2 rounded-full bg-emerald-300 fusion-pulse" />
                  Live
                </span>
              </div>
              <h2 className="mt-2 font-headline text-3xl font-bold">All Built HR Modules</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/85">
                Every HR service is reachable from the product UI with clear status, data objects, people roles, and an operations path where a full page is not configured yet.
              </p>
            </div>
            <Button asChild className="w-fit self-end bg-white text-primary hover:bg-accent">
              <Link to="/admin/system-console/settings">
                <Gauge className="mr-2 h-4 w-4" />
                Admin Setup
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 border-b border-white/40 p-4 lg:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search modules, workflows, or objects"
                aria-label="Search modules, workflows, or objects"
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

          <div className="grid sm:grid-cols-2 xl:grid-cols-4">
            <StatBlock label="Total Modules" value={commercialModules.length} icon={Layers3} />
            <StatBlock label="Full Pages" value={nativeCount} icon={CheckCircle2} />
            <StatBlock label="Operations" value={workbenchCount} icon={Activity} />
            <StatBlock label="Setup Needed" value={apiReadyCount} icon={BarChart3} />
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredModules.map((module) => (
            <ModuleCard key={module.id} module={module} />
          ))}
        </section>

        {filteredModules.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No modules match this search"
            description="Try a different keyword or clear the filters to see every built HR module."
            action={{ label: 'Clear filters', onClick: () => { setSearch(''); setCategory(''); } }}
          />
        ) : null}
      </div>
    </div>
  );
}
