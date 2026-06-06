import type { ComponentType, ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Boxes,
  CheckCircle2,
  Database,
  ExternalLink,
  GitBranch,
  LockKeyhole,
  Route,
  Sparkles,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { findCommercialModule, type CommercialModuleMaturity } from '@/lib/commercial-modules';

const maturityTone: Record<CommercialModuleMaturity, string> = {
  'native-ui': 'border-[#8b5cf6]/30 bg-[#8b5cf6]/10 text-[#4f46e5]',
  workbench: 'border-[#6366f1]/30 bg-[#6366f1]/10 text-[#6366f1]',
  'api-ready': 'border-[#f59e0b]/30 bg-[#fde68a]/65 text-[#92400e]',
};

const maturityLabel: Record<CommercialModuleMaturity, string> = {
  'native-ui': 'Native UI',
  workbench: 'Workbench',
  'api-ready': 'API Ready',
};

function InsightCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <Card className="relative overflow-hidden border-transparent fusion-glass rounded-2xl">
      <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-teal-400" />
      <CardHeader className="flex-row items-center gap-3 space-y-0 p-5">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#8b5cf6]/10 text-[#4f46e5]">
          <Icon className="h-5 w-5" />
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-5 pt-0">{children}</CardContent>
    </Card>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm leading-6 text-[#475569]">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#4f46e5]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function AdminModuleWorkbench() {
  const { moduleId } = useParams();
  const module = findCommercialModule(moduleId);

  if (!module) {
    return <Navigate to="/admin/modules" replace />;
  }

  return (
    <div className="min-h-full">
      <div className="lumina-canvas space-y-5">
        <Button asChild variant="ghost" size="sm" className="w-fit">
          <Link to="/admin/modules">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to modules
          </Link>
        </Button>

        <section className="fusion-glass rounded-[2rem] overflow-hidden">
          <div className="grid gap-5 bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-500 p-6 text-white lg:grid-cols-[1fr_auto]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn('rounded-full border bg-white px-2 py-1 font-mono text-xs uppercase tracking-wider', maturityTone[module.maturity])}>
                  {maturityLabel[module.maturity]}
                </Badge>
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#a5b4fc]">{module.category}</span>
              </div>
              <h2 className="mt-3 font-headline text-3xl font-bold">{module.label}</h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-white/85">{module.summary}</p>
            </div>
            <div className="flex flex-wrap items-end gap-2 lg:justify-end">
              {module.nativePath ? (
                <Button asChild className="bg-white text-[#4f46e5] hover:bg-[#eef2ff]">
                  <Link to={module.nativePath}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Operations Workspace
                  </Link>
                </Button>
              ) : null}
              <Button asChild variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                <Link to="/admin/system-console">Open Admin Panel</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-3">
            <div className="rounded-lg border border-[#e2e8f0]/70 bg-[#eef2ff] p-4">
              <p className="lumina-label">Backend Route</p>
              <p className="mt-2 font-mono text-sm font-semibold text-[#0f172a]">{module.backendRoot}</p>
            </div>
            <div className="rounded-lg border border-[#e2e8f0]/70 bg-[#eef2ff] p-4">
              <p className="lumina-label">Personas</p>
              <p className="mt-2 text-sm font-semibold text-[#0f172a]">{module.personas.join(', ')}</p>
            </div>
            <div className="rounded-lg border border-[#e2e8f0]/70 bg-[#eef2ff] p-4">
              <p className="lumina-label">UI Exposure</p>
              <p className="mt-2 text-sm font-semibold text-[#0f172a]">{maturityLabel[module.maturity]}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <InsightCard title="What Is Already Built" icon={Boxes}>
            <BulletList items={module.builtCapabilities} />
          </InsightCard>

          <InsightCard title="Commercial Workflows" icon={GitBranch}>
            <BulletList items={module.keyWorkflows} />
          </InsightCard>

          <InsightCard title="Data Users Can Trust" icon={Database}>
            <div className="flex flex-wrap gap-2">
              {module.dataObjects.map((item) => (
                <span key={item} className="rounded-md border border-[#e2e8f0]/70 bg-[#eef2ff] px-2 py-1 text-xs font-medium text-[#475569]">
                  {item}
                </span>
              ))}
            </div>
          </InsightCard>

          <InsightCard title="Governance and Access" icon={LockKeyhole}>
            <BulletList items={module.governance} />
          </InsightCard>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_24rem]">
          <Card className="relative overflow-hidden border-transparent fusion-glass rounded-2xl">
            <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-indigo-500 to-violet-500" />
            <CardHeader className="p-5">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-[#6366f1]" />
                Next Commercial UI Work
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <BulletList items={module.commercialNext} />
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-transparent fusion-glass rounded-2xl">
            <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-amber-400 to-orange-500" />
            <CardHeader className="p-5">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Route className="h-5 w-5 text-[#f59e0b]" />
                Route Contract
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5 pt-0 text-sm leading-6 text-[#475569]">
              <p>This workbench is the UI landing zone for backend capabilities that do not yet have a full product page.</p>
              <p>Dedicated pages should keep this route visible as the governance, workflow, and data dictionary layer.</p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/admin/modules">
                  <Users className="mr-2 h-4 w-4" />
                  View All Modules
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
