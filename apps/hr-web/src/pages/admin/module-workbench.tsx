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
  'native-ui': 'border-[#10b981]/30 bg-[#10b981]/10 text-[#006c49]',
  workbench: 'border-[#4648d4]/30 bg-[#4648d4]/10 text-[#4648d4]',
  'api-ready': 'border-[#e29100]/30 bg-[#ffddb8]/65 text-[#653e00]',
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
    <Card className="relative overflow-hidden">
      <div className="lumina-accent-strip" />
      <CardHeader className="flex-row items-center gap-3 space-y-0 p-5">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#10b981]/10 text-[#006c49]">
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
    <ul className="space-y-2 text-sm leading-6 text-[#3c4a42]">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#006c49]" />
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
    <div className="min-h-full bg-[#f8f9ff]">
      <div className="lumina-canvas space-y-5">
        <Button asChild variant="ghost" size="sm" className="w-fit">
          <Link to="/admin/modules">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to modules
          </Link>
        </Button>

        <section className="lumina-panel overflow-hidden">
          <div className="grid gap-5 border-b border-[#bbcabf] bg-[#006c49] p-6 text-white lg:grid-cols-[1fr_auto]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn('rounded-full border bg-white px-2 py-1 font-mono text-xs uppercase tracking-wider', maturityTone[module.maturity])}>
                  {maturityLabel[module.maturity]}
                </Badge>
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#6ffbbe]">{module.category}</span>
              </div>
              <h2 className="mt-3 font-headline text-3xl font-bold">{module.label}</h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-white/85">{module.summary}</p>
            </div>
            <div className="flex flex-wrap items-end gap-2 lg:justify-end">
              {module.nativePath ? (
                <Button asChild className="bg-white text-[#006c49] hover:bg-[#eff4ff]">
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

          <div className="grid gap-4 bg-white p-5 md:grid-cols-3">
            <div className="rounded-lg border border-[#bbcabf]/70 bg-[#eff4ff] p-4">
              <p className="lumina-label">Backend Route</p>
              <p className="mt-2 font-mono text-sm font-semibold text-[#0b1c30]">{module.backendRoot}</p>
            </div>
            <div className="rounded-lg border border-[#bbcabf]/70 bg-[#eff4ff] p-4">
              <p className="lumina-label">Personas</p>
              <p className="mt-2 text-sm font-semibold text-[#0b1c30]">{module.personas.join(', ')}</p>
            </div>
            <div className="rounded-lg border border-[#bbcabf]/70 bg-[#eff4ff] p-4">
              <p className="lumina-label">UI Exposure</p>
              <p className="mt-2 text-sm font-semibold text-[#0b1c30]">{maturityLabel[module.maturity]}</p>
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
                <span key={item} className="rounded-md border border-[#bbcabf]/70 bg-[#eff4ff] px-2 py-1 text-xs font-medium text-[#3c4a42]">
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
          <Card className="relative overflow-hidden">
            <div className="lumina-accent-strip bg-[#4648d4]" />
            <CardHeader className="p-5">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-[#4648d4]" />
                Next Commercial UI Work
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <BulletList items={module.commercialNext} />
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="lumina-accent-strip bg-[#e29100]" />
            <CardHeader className="p-5">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Route className="h-5 w-5 text-[#e29100]" />
                Route Contract
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5 pt-0 text-sm leading-6 text-[#3c4a42]">
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
