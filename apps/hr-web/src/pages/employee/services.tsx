import * as React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { commercialModules, moduleOperationsPath, type CommercialModule } from '@/lib/commercial-modules';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  HeartHandshake,
  HelpCircle,
  Inbox,
  Landmark,
  Layers3,
  LifeBuoy,
  Search,
  Send,
  ShieldCheck,
  UserCog,
} from 'lucide-react';

interface HrServiceCatalogItem {
  id: string;
  serviceCode: string;
  serviceName: string;
  description: string;
  category: string;
  slaHours: number;
  fulfillmentProcess: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'RETIRED';
}

interface HrServiceCase {
  id: string;
  caseNumber: string;
  requesterWorkerId: string;
  caseType: string;
  priority: string;
  description: string;
  assignedTo?: string;
  slaDeadline?: string;
  resolvedAt?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'PENDING_CUSTOMER' | 'RESOLVED' | 'CLOSED' | 'ESCALATED';
  createdAt: string;
  updatedAt: string;
}

interface OpenServiceCasePayload {
  caseType: string;
  priority: string;
  description: string;
}

interface OpenServiceCaseResponse {
  hrServiceCaseId: string;
  caseNumber: string;
  caseType: string;
  priority: string;
  status: string;
}

const fallbackCatalog: HrServiceCatalogItem[] = [
  {
    id: 'fallback-hr-letter',
    serviceCode: 'HR_LETTER',
    serviceName: 'Employment letter request',
    description: 'Request salary, employment, embassy, bank, or visa letters from HR.',
    category: 'Documents',
    slaHours: 24,
    fulfillmentProcess: 'HR verifies worker data, prepares the letter, and publishes the signed document.',
    status: 'ACTIVE',
  },
  {
    id: 'fallback-payroll',
    serviceCode: 'PAYROLL_HELP',
    serviceName: 'Payroll or payslip question',
    description: 'Ask about payslips, deductions, bank details, reimbursements, or payment timing.',
    category: 'Payroll & Reward',
    slaHours: 48,
    fulfillmentProcess: 'Payroll validates the run, checks employee inputs, and responds with correction or explanation.',
    status: 'ACTIVE',
  },
  {
    id: 'fallback-benefits',
    serviceCode: 'BENEFITS_SUPPORT',
    serviceName: 'Benefits support',
    description: 'Get help with coverage, dependents, life events, medical cards, or enrollment windows.',
    category: 'Benefits',
    slaHours: 48,
    fulfillmentProcess: 'Benefits admin reviews eligibility, carrier rules, evidence, and enrollment status.',
    status: 'ACTIVE',
  },
  {
    id: 'fallback-profile',
    serviceCode: 'PROFILE_DATA_CHANGE',
    serviceName: 'Profile data correction',
    description: 'Request corrections to personal, employment, organization, or document data.',
    category: 'Core HR',
    slaHours: 72,
    fulfillmentProcess: 'HR validates evidence, applies permitted profile updates, and records audit evidence.',
    status: 'ACTIVE',
  },
  {
    id: 'fallback-access',
    serviceCode: 'ACCESS_ONBOARDING',
    serviceName: 'Access and onboarding help',
    description: 'Report onboarding, provisioning, buddy assignment, or IT access blockers.',
    category: 'Onboarding & Access',
    slaHours: 24,
    fulfillmentProcess: 'HR coordinates IT, manager, security, and facilities tasks until access is confirmed.',
    status: 'ACTIVE',
  },
];

const serviceIcons = [FileText, Landmark, HeartHandshake, UserCog, ShieldCheck, HelpCircle];

const employeeModuleRoutes: Record<string, string> = {
  employees: '/employee/profile',
  attendance: '/employee#attendance',
  leave: '/employee/time-off',
  payroll: '/employee/payslip',
  benefits: '/employee/benefits',
  onboarding: '/employee/onboarding',
  performance: '/employee/performance',
  'service-delivery': '/employee/services',
};

const priorityOptions = [
  { value: 'LOW', label: 'Low', hint: 'Question or routine request' },
  { value: 'MEDIUM', label: 'Medium', hint: 'Needs HR follow-up' },
  { value: 'HIGH', label: 'High', hint: 'Time-sensitive blocker' },
  { value: 'URGENT', label: 'Urgent', hint: 'Payroll, access, or compliance risk' },
];

function formatDate(value?: string) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}

function statusTone(status: HrServiceCase['status']) {
  if (status === 'RESOLVED' || status === 'CLOSED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'ESCALATED') return 'border-red-200 bg-red-50 text-red-700';
  if (status === 'PENDING_CUSTOMER') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-sky-200 bg-sky-50 text-sky-700';
}

function employeeVisibleModules() {
  return commercialModules.filter((module) => (
    module.personas.some((persona) => ['Employee', 'New Hire'].includes(persona))
    || Boolean(employeeModuleRoutes[module.id])
  ));
}

function adminGovernedModules(employeeModules: CommercialModule[]) {
  const employeeModuleIds = new Set(employeeModules.map((module) => module.id));
  return commercialModules.filter((module) => !employeeModuleIds.has(module.id));
}

function adminPathFor(module: CommercialModule) {
  return module.nativePath ?? moduleOperationsPath(module.id);
}

export function EmployeeServices() {
  const { roles } = useAuth();
  const [search, setSearch] = React.useState('');
  const [selectedCode, setSelectedCode] = React.useState('HR_LETTER');
  const [priority, setPriority] = React.useState('MEDIUM');
  const [description, setDescription] = React.useState('');
  const [message, setMessage] = React.useState('');
  const canOpenAdminWorkspaces = React.useMemo(
    () => roles.some((role) => ['HR_ADMIN', 'SUPER_ADMIN'].includes(role.name)),
    [roles],
  );

  const {
    data: catalogData = [],
    isLoading: catalogLoading,
    isError: catalogError,
  } = useApiQuery<HrServiceCatalogItem[]>(['employee-services-catalog'], '/hr-service-delivery/catalog-items');
  const {
    data: cases = [],
    isLoading: casesLoading,
    isError: casesError,
  } = useApiQuery<HrServiceCase[]>(['employee-services-cases'], '/hr-service-delivery/cases/my');

  const catalog = React.useMemo(() => {
    const active = catalogData.filter((item) => item.status === 'ACTIVE');
    return active.length > 0 ? active : fallbackCatalog;
  }, [catalogData]);

  React.useEffect(() => {
    if (!catalog.some((item) => item.serviceCode === selectedCode) && catalog[0]) {
      setSelectedCode(catalog[0].serviceCode);
    }
  }, [catalog, selectedCode]);

  const selectedService = catalog.find((item) => item.serviceCode === selectedCode) ?? catalog[0];
  const filteredCatalog = catalog.filter((item) => {
    const haystack = `${item.serviceName} ${item.description} ${item.category}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  const openCaseMutation = useApiMutation<OpenServiceCaseResponse, OpenServiceCasePayload>(
    '/hr-service-delivery/cases',
    'post',
    [['employee-services-cases']],
  );

  const submitRequest = async () => {
    if (!selectedService || !description.trim()) return;
    setMessage('');
    try {
      const result = await openCaseMutation.mutateAsync({
        caseType: selectedService.serviceCode,
        priority,
        description: description.trim(),
      });
      setDescription('');
      setPriority('MEDIUM');
      setMessage(`Service case ${result.caseNumber} opened and routed to HR.`);
    } catch {
      // The mutation state renders the actionable error message below the form.
    }
  };

  const openCases = cases.filter((item) => !['RESOLVED', 'CLOSED'].includes(item.status)).length;
  const closedCases = cases.length - openCases;
  const modules = employeeVisibleModules();
  const adminModules = adminGovernedModules(modules);
  const employeeNativeCount = modules.filter((module) => employeeModuleRoutes[module.id]).length;

  return (
    <div className="min-h-[calc(100vh-96px)] bg-[#eef3f8] px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto max-w-[1480px] space-y-5">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-lg border border-[#c9d5e3] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <Badge variant="secondary" className="mb-3 bg-[#dff7ed] text-[#006c49]">Employee Services</Badge>
                <h1 className="font-headline text-3xl font-semibold text-slate-950 md:text-4xl">Ask HR, track requests, and get support</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Open a service case for documents, payroll, benefits, profile corrections, onboarding access, or any HR support need.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Open</p>
                  <p className="text-xl font-semibold text-slate-950">{openCases}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Resolved</p>
                  <p className="text-xl font-semibold text-slate-950">{closedCases}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Catalog</p>
                  <p className="text-xl font-semibold text-slate-950">{catalog.length}</p>
                </div>
              </div>
            </div>
          </div>

          <Card className="rounded-lg border-[#c9d5e3] bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <LifeBuoy className="h-5 w-5 text-[#006c49]" />
                Service Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                <span className="text-slate-600">Catalog API</span>
                <Badge variant={catalogError ? 'destructive' : 'outline'}>{catalogError ? 'Fallback' : 'Live'}</Badge>
              </div>
              <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                <span className="text-slate-600">My cases API</span>
                <Badge variant={casesError ? 'destructive' : 'outline'}>{casesError ? 'Error' : 'Live'}</Badge>
              </div>
              <p className="text-xs leading-5 text-slate-500">Submitting a request uses the HR service-delivery command workflow and audit trail.</p>
            </CardContent>
          </Card>
        </section>

        <section className="rounded-lg border border-[#c9d5e3] bg-white shadow-sm">
          <div className="grid gap-4 border-b border-[#d7e1ec] p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <Badge variant="secondary" className="mb-3 bg-[#eff4ff] text-[#006c49]">Built Module Coverage</Badge>
              <h2 className="font-headline text-2xl font-semibold text-slate-950">Platform coverage visible from the employee side</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                This launcher mirrors the platform module registry so employee self-service does not hide built capabilities behind unknown routes.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2">
                <p className="text-xs text-slate-500">Employee routes</p>
                <p className="text-xl font-semibold text-slate-950">{employeeNativeCount}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2">
                <p className="text-xs text-slate-500">Admin governed</p>
                <p className="text-xl font-semibold text-slate-950">{adminModules.length}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2">
                <p className="text-xs text-slate-500">Registered domains</p>
                <p className="text-xl font-semibold text-slate-950">{commercialModules.length}</p>
              </div>
            </div>
          </div>

          <div className="border-b border-[#d7e1ec] px-4 pt-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Employee self-service launchers</h3>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
            {modules.map((module) => {
              const employeePath = employeeModuleRoutes[module.id];
              return (
                <div key={module.id} className="flex min-h-[210px] flex-col rounded-lg border border-[#d7e1ec] bg-[#fbfdff] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-md bg-[#e7f8ef] text-[#006c49]">
                      <Layers3 className="h-5 w-5" />
                    </span>
                    <Badge variant="outline" className="capitalize">{module.maturity.replace('-', ' ')}</Badge>
                  </div>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[#006c49]">{module.category}</p>
                  <h3 className="mt-1 text-base font-semibold text-slate-950">{module.label}</h3>
                  <p className="mt-2 flex-1 text-sm leading-5 text-slate-600">{module.summary}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {employeePath ? (
                      <Button asChild size="sm">
                        <Link to={employeePath}>Open Employee View</Link>
                      </Button>
                    ) : (
                      <Badge variant="secondary" className="bg-slate-100 text-slate-600">No employee screen yet</Badge>
                    )}
                    {canOpenAdminWorkspaces ? (
                      <Button asChild size="sm" variant="outline">
                        <Link to={adminPathFor(module)}>Admin Workspace</Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t border-[#d7e1ec] bg-slate-50 px-4 py-4">
            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Admin-governed platform domains</h3>
                <p className="mt-1 text-sm text-slate-600">
                  These modules are built into the platform operations layer, but are not employee self-service actions.
                </p>
              </div>
              {canOpenAdminWorkspaces ? (
                <Button asChild size="sm" variant="outline">
                  <Link to="/admin/modules">Open Full Catalog</Link>
                </Button>
              ) : null}
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {adminModules.map((module) => (
                <div key={module.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-950">{module.label}</p>
                    <p className="truncate text-xs text-slate-500">{module.category} / {module.backendRoot}</p>
                  </div>
                  {canOpenAdminWorkspaces ? (
                    <Button asChild size="sm" variant="outline">
                      <Link to={adminPathFor(module)}>Admin</Link>
                    </Button>
                  ) : (
                    <Badge variant="secondary" className="shrink-0 bg-slate-100 text-slate-600">Admin</Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
          {canOpenAdminWorkspaces ? (
            <div className="border-t border-[#d7e1ec] bg-slate-50 px-4 py-3 text-sm text-slate-600">
              HR admin preview is enabled. The full admin catalog is available at{' '}
              <Link to="/admin/modules" className="font-semibold text-[#006c49] underline">Module Catalog</Link>.
            </div>
          ) : null}
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-lg border border-[#c9d5e3] bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-headline text-2xl font-semibold text-slate-950">Service Catalog</h2>
                <p className="text-sm text-slate-600">Pick a service to prefill routing and SLA expectations.</p>
              </div>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search services..." className="pl-9" />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {filteredCatalog.map((item, index) => {
                const Icon = serviceIcons[index % serviceIcons.length];
                const selected = item.serviceCode === selectedCode;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      'group flex min-h-[190px] flex-col rounded-lg border bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#006c49]/50',
                      selected ? 'border-[#006c49] ring-2 ring-[#006c49]/15' : 'border-[#c9d5e3]',
                    )}
                    onClick={() => setSelectedCode(item.serviceCode)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid h-11 w-11 place-items-center rounded-md bg-[#e7f8ef] text-[#006c49]">
                        <Icon className="h-5 w-5" />
                      </span>
                      <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-[#006c49]" />
                    </div>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">{item.category}</p>
                    <h3 className="mt-1 text-base font-semibold text-slate-950">{item.serviceName}</h3>
                    <p className="mt-2 flex-1 text-sm leading-5 text-slate-600">{item.description}</p>
                    <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                      <Clock3 className="h-4 w-4" />
                      SLA {item.slaHours || 24}h
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="space-y-4">
            <Card className="rounded-lg border-[#c9d5e3] bg-white shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl">Open New Request</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Service</label>
                  <Select value={selectedCode} onValueChange={setSelectedCode}>
                    <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                    <SelectContent>
                      {catalog.map((item) => (
                        <SelectItem key={item.id} value={item.serviceCode}>{item.serviceName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Priority</label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {priorityOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label} - {option.hint}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Details</label>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Describe what you need, deadlines, documents, or evidence..."
                    className="min-h-[132px] w-full resize-y rounded-lg border border-transparent bg-[#f1f5f9] px-3 py-2 text-sm text-[#0b1c30] outline-none placeholder:text-[#6c7a71] focus:border-[#006c49] focus:bg-white focus:ring-2 focus:ring-[#006c49]/20"
                  />
                </div>
                {selectedService ? (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                    <p className="font-semibold text-slate-800">Fulfillment workflow</p>
                    <p className="mt-1">{selectedService.fulfillmentProcess}</p>
                  </div>
                ) : null}
                <Button className="w-full" disabled={!description.trim() || openCaseMutation.isPending} onClick={submitRequest}>
                  <Send className="mr-2 h-4 w-4" />
                  {openCaseMutation.isPending ? 'Submitting...' : 'Submit Service Request'}
                </Button>
                {message ? (
                  <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>
                ) : null}
                {openCaseMutation.isError ? (
                  <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    Service request failed. Check that the service-delivery migration has run and your employee profile is active.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </aside>
        </section>

        <section className="rounded-lg border border-[#c9d5e3] bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-[#d7e1ec] p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-headline text-2xl font-semibold text-slate-950">My Service Cases</h2>
              <p className="text-sm text-slate-600">Track requests opened from Employee Self-Service.</p>
            </div>
            <Badge variant="outline">{cases.length} total</Badge>
          </div>
          <div className="divide-y divide-slate-100">
            {casesLoading ? (
              <div className="p-6 text-sm text-slate-500">Loading service cases...</div>
            ) : null}
            {!casesLoading && cases.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-10 text-center">
                <Inbox className="h-10 w-10 text-slate-300" />
                <h3 className="mt-3 font-semibold text-slate-950">No service cases yet</h3>
                <p className="mt-1 max-w-md text-sm text-slate-500">Choose a service above and submit your first HR request.</p>
              </div>
            ) : null}
            {cases.map((serviceCase) => (
              <div key={serviceCase.id} className="grid gap-3 p-4 md:grid-cols-[170px_minmax(0,1fr)_180px_150px] md:items-center">
                <div>
                  <p className="font-mono text-sm font-semibold text-slate-950">{serviceCase.caseNumber}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(serviceCase.createdAt)}</p>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-950">{serviceCase.caseType.replace(/_/g, ' ')}</p>
                  <p className="mt-1 truncate text-sm text-slate-600">{serviceCase.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  {serviceCase.status === 'RESOLVED' || serviceCase.status === 'CLOSED' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : serviceCase.status === 'ESCALATED' ? (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  ) : (
                    <Clock3 className="h-4 w-4 text-sky-600" />
                  )}
                  <Badge variant="outline" className={statusTone(serviceCase.status)}>{serviceCase.status.replace(/_/g, ' ')}</Badge>
                </div>
                <div className="text-sm text-slate-500 md:text-right">
                  <p>Priority {serviceCase.priority}</p>
                  <p className="text-xs">SLA {formatDate(serviceCase.slaDeadline)}</p>
                </div>
              </div>
            ))}
          </div>
          {casesError ? (
            <p className="border-t border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              Could not load service cases. The service-delivery API may need the new migration.
            </p>
          ) : null}
          {catalogLoading ? (
            <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">Loading live service catalog...</p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
