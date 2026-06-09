import * as React from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/common/data-table';
import { buildOrganizationSetupJourney, type OrganizationSetupJourneyTone, type OrganizationSetupTab } from '@/lib/organization-setup-journey';
import { cn } from '@/lib/utils';
import { BarChart3, Brain, Building2, Calculator, GitBranch, Network, Save, Sparkles, UserCog } from 'lucide-react';

type LegalEntity = {
  id: string;
  name: string;
  code?: string;
  countryCode: string;
  registrationNumber?: string | null;
  status: string;
};

type OrgUnit = {
  id: string;
  name: string;
  code?: string | null;
  parentId?: string | null;
  legalEntityId?: string | null;
  level: number;
  status: string;
  children?: OrgUnit[];
};

type Worker = {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle?: string;
  departmentId?: string;
  managerId?: string;
  legalEntityId?: string;
};

type ManagerRelationship = {
  id: string;
  workerId: string;
  workerName: string;
  managerId: string;
  managerName: string;
  departmentId?: string | null;
  isPrimary: boolean;
  startDate: string;
  endDate?: string | null;
};

type OrganizationSummary = {
  legalEntities: LegalEntity[];
  orgUnits: OrgUnit[];
  orgChart: OrgUnit[];
  managerRelationships: ManagerRelationship[];
};

type PlanningGroup = {
  id: string;
  name: string;
  headcount: number;
  positionCount: number;
  vacancies: number;
  annualCost: number;
  employees: Array<{ id: string; name: string; jobTitle?: string; status: string }>;
};

type DynamicOrgChartResponse = {
  groupBy: string;
  filters: string[];
  nodes: PlanningGroup[];
};

type WorkforcePlanningDashboard = {
  summary: {
    currentHeadcount: number;
    activeHeadcount: number;
    legalEntities: number;
    departments: number;
    totalPositions: number;
    filledPositions: number;
    vacancies: number;
    pendingHeadcount: number;
    approvedHeadcount: number;
  };
  orgChart: {
    byDepartment: PlanningGroup[];
    byLegalEntity: PlanningGroup[];
    byManager: PlanningGroup[];
  };
  headcountPlan: Array<{
    departmentId: string;
    departmentName: string;
    currentHeadcount: number;
    approvedPositions: number;
    vacancies: number;
    pendingRequests: number;
    approvedRequests: number;
    forecastDemand: number;
  }>;
  workforceCostPlan: {
    salary: number;
    benefits: number;
    socialInsuranceAndTax: number;
    overtime: number;
    allowancesTravelRelocation: number;
    training: number;
    contractorCost: number;
    totalAnnualCost: number;
  };
  skillsGap: Array<{
    skill: string;
    required: number;
    available: number;
    gap: number;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  strategicDashboard: {
    vacancyRiskPercent: number;
    retirementRisk: number;
    successionGaps: number;
    criticalRolesWithoutBackup: number;
    attritionHotspots: Array<{ departmentId: string; departmentName: string; terminations: number }>;
    genderBalance: Array<{ gender: string; count: number }>;
    productivityPerEmployee: number;
  };
  aiForecast: Array<{
    horizonMonths: number;
    forecastHeadcountDemand: number;
    deltaFromToday: number;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    drivers: string[];
  }>;
};

type ScenarioForm = {
  name: string;
  branchExpansionCount: string;
  rolesPerBranch: string;
  adminReductionPercent: string;
  outsourceHeadcount: string;
  demandGrowthPercent: string;
  automationOffsetPercent: string;
  aiAgentCapacity: string;
  averageCostPerFte: string;
};

type ScenarioResult = {
  name: string;
  baseline: {
    headcount: number;
    annualCost: number;
    averageCostPerFte: number;
  };
  drivers: Record<string, number>;
  projected: {
    headcount: number;
    annualCost: number;
    headcountDelta: number;
    costDelta: number;
  };
  recommendation: string;
};

type LegalEntityForm = {
  id?: string;
  name: string;
  countryCode: string;
  registrationNumber: string;
};

type OrgUnitForm = {
  id?: string;
  name: string;
  legalEntityId: string;
  parentOrgUnitId: string;
};

type AssignmentForm = {
  workerId: string;
  legalEntityId: string;
  departmentId: string;
  managerId: string;
  jobTitle: string;
};

type ReportingNode = {
  id: string;
  name: string;
  employeeId?: string;
  jobTitle?: string;
  departmentId?: string | null;
  directReports: ReportingNode[];
};

const emptyLegalEntity: LegalEntityForm = { name: '', countryCode: 'EG', registrationNumber: '' };
const emptyOrgUnit: OrgUnitForm = { name: '', legalEntityId: '', parentOrgUnitId: '' };
const emptyAssignment: AssignmentForm = { workerId: '', legalEntityId: '', departmentId: '', managerId: '', jobTitle: '' };
const emptyScenario: ScenarioForm = {
  name: 'Growth plan',
  branchExpansionCount: '0',
  rolesPerBranch: '0',
  adminReductionPercent: '0',
  outsourceHeadcount: '0',
  demandGrowthPercent: '0',
  automationOffsetPercent: '0',
  aiAgentCapacity: '0',
  averageCostPerFte: '',
};
const emptyWorkers: Worker[] = [];
const emptyOrgUnits: OrgUnit[] = [];
const emptyLegalEntities: LegalEntity[] = [];
const emptyManagerRelationships: ManagerRelationship[] = [];
const emptyOrgChart: OrgUnit[] = [];

const setupToneClasses: Record<OrganizationSetupJourneyTone, string> = {
  attention: 'border-red-200 bg-red-50 text-red-700',
  default: 'border-indigo-100 bg-indigo-50 text-indigo-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-orange-200 bg-orange-50 text-orange-700',
};

const moneyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function formatMoney(value: number | undefined) {
  return moneyFormatter.format(value ?? 0);
}

function numberOrUndefined(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function scenarioPayload(form: ScenarioForm) {
  return {
    name: form.name || undefined,
    branchExpansionCount: numberOrUndefined(form.branchExpansionCount),
    rolesPerBranch: numberOrUndefined(form.rolesPerBranch),
    adminReductionPercent: numberOrUndefined(form.adminReductionPercent),
    outsourceHeadcount: numberOrUndefined(form.outsourceHeadcount),
    demandGrowthPercent: numberOrUndefined(form.demandGrowthPercent),
    automationOffsetPercent: numberOrUndefined(form.automationOffsetPercent),
    aiAgentCapacity: numberOrUndefined(form.aiAgentCapacity),
    averageCostPerFte: numberOrUndefined(form.averageCostPerFte),
  };
}

function unwrap<T>(response: { data: { data: T } }) {
  return response.data.data;
}

function getErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string | string[]; errorMessage?: string; errorCode?: string } } }).response;
    const data = response?.data;
    if (Array.isArray(data?.message)) return data.message.join(', ');
    return data?.message ?? data?.errorMessage ?? data?.errorCode ?? 'Request failed';
  }
  if (error instanceof Error) return error.message;
  return 'Request failed';
}

function ErrorMessage({ error }: { error: unknown }) {
  const message = getErrorMessage(error);
  if (!message) return null;
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
      {message}
    </div>
  );
}

function workerName(worker: Worker) {
  return `${worker.firstName} ${worker.lastName}`.trim();
}

function buildReportingTree(workers: Worker[], relationships: ManagerRelationship[]): ReportingNode[] {
  const nodes = new Map<string, ReportingNode>();
  const directReportIds = new Set<string>();

  const ensureNode = (id: string, fallbackName?: string) => {
    const existing = nodes.get(id);
    if (existing) return existing;

    const worker = workers.find((candidate) => candidate.id === id);
    const node: ReportingNode = {
      id,
      name: worker ? workerName(worker) : fallbackName ?? id,
      employeeId: worker?.employeeId,
      jobTitle: worker?.jobTitle,
      departmentId: worker?.departmentId,
      directReports: [],
    };
    nodes.set(id, node);
    return node;
  };

  workers.forEach((worker) => ensureNode(worker.id));

  relationships
    .filter((relationship) => !relationship.endDate && relationship.workerId !== relationship.managerId)
    .forEach((relationship) => {
      const managerNode = ensureNode(relationship.managerId, relationship.managerName);
      const workerNode = ensureNode(relationship.workerId, relationship.workerName);
      if (!managerNode.directReports.some((directReport) => directReport.id === workerNode.id)) {
        managerNode.directReports.push(workerNode);
      }
      directReportIds.add(workerNode.id);
    });

  const sortNodes = (items: ReportingNode[]) => {
    items.sort((a, b) => a.name.localeCompare(b.name));
    items.forEach((item) => sortNodes(item.directReports));
    return items;
  };

  return sortNodes([...nodes.values()].filter((node) => !directReportIds.has(node.id)));
}

function OrgTree({ nodes, depth = 0 }: { nodes: OrgUnit[]; depth?: number }) {
  if (nodes.length === 0) {
    return <p className="text-sm text-muted-foreground">No active org structure yet. Create a legal entity, then add departments or teams.</p>;
  }

  return (
    <div className="space-y-2">
      {nodes.map((node) => (
        <div key={node.id}>
          <div className="fusion-glass flex items-center gap-3 rounded-2xl p-3" style={{ marginLeft: depth * 20 }}>
            <Network className="h-4 w-4 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{node.name}</p>
              <p className="text-xs text-muted-foreground">{node.status} · level {node.level}</p>
            </div>
            <Badge variant="outline">{node.children?.length ?? 0} children</Badge>
          </div>
          {node.children && node.children.length > 0 ? <OrgTree nodes={node.children} depth={depth + 1} /> : null}
        </div>
      ))}
    </div>
  );
}

function ReportingTree({ nodes, depth = 0, visited = new Set<string>() }: { nodes: ReportingNode[]; depth?: number; visited?: Set<string> }) {
  if (nodes.length === 0) {
    return <p className="text-sm text-muted-foreground">No active employee reporting lines yet.</p>;
  }

  return (
    <div className="space-y-2">
      {nodes.map((node) => {
        const hasCycle = visited.has(node.id);
        const nextVisited = new Set(visited);
        nextVisited.add(node.id);

        return (
          <div key={`${node.id}-${depth}`}>
            <div className="fusion-glass flex items-center gap-3 rounded-2xl p-3" style={{ marginLeft: depth * 20 }}>
              <UserCog className="h-4 w-4 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{node.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {node.jobTitle ?? 'No title'}{node.employeeId ? ` · ${node.employeeId}` : ''}
                </p>
              </div>
              <Badge variant={node.directReports.length > 0 ? 'default' : 'outline'}>{node.directReports.length}</Badge>
            </div>
            {!hasCycle && node.directReports.length > 0 ? (
              <ReportingTree nodes={node.directReports} depth={depth + 1} visited={nextVisited} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function AdminOrganization({ initialTab = 'structure' }: { initialTab?: string }) {
  const queryClient = useQueryClient();
  const [legalEntityForm, setLegalEntityForm] = React.useState<LegalEntityForm>(emptyLegalEntity);
  const [orgUnitForm, setOrgUnitForm] = React.useState<OrgUnitForm>(emptyOrgUnit);
  const [assignmentForm, setAssignmentForm] = React.useState<AssignmentForm>(emptyAssignment);
  const [activeTab, setActiveTab] = React.useState<OrganizationSetupTab>(initialTab as OrganizationSetupTab);
  const [chartGroupBy, setChartGroupBy] = React.useState('department');
  const [scenarioForm, setScenarioForm] = React.useState<ScenarioForm>(emptyScenario);
  const [scenarioResult, setScenarioResult] = React.useState<ScenarioResult | null>(null);
  const [actionError, setActionError] = React.useState<unknown>(null);

  const summaryQuery = useQuery({
    queryKey: ['admin-organization-summary'],
    queryFn: async () => unwrap<OrganizationSummary>(await apiClient.get('/hr/organization/summary')),
  });

  const workersQuery = useQuery({
    queryKey: ['admin-organization-workers'],
    queryFn: async () => {
      const payload = unwrap<Worker[] | { items?: Worker[] }>(await apiClient.get('/hr/core/workers?pageSize=250'));
      return Array.isArray(payload) ? payload : payload?.items ?? [];
    },
  });

  const planningQuery = useQuery({
    queryKey: ['admin-workforce-planning'],
    queryFn: async () => unwrap<WorkforcePlanningDashboard>(await apiClient.get('/hr/organization/workforce-planning')),
  });

  const dynamicChartQuery = useQuery({
    queryKey: ['admin-workforce-org-chart', chartGroupBy],
    queryFn: async () => unwrap<DynamicOrgChartResponse>(await apiClient.get(`/hr/organization/org-chart?groupBy=${chartGroupBy}`)),
  });

  const refreshOrg = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-organization-summary'] });
    queryClient.invalidateQueries({ queryKey: ['admin-workforce-planning'] });
    queryClient.invalidateQueries({ queryKey: ['admin-workforce-org-chart'] });
  };

  const saveLegalEntity = useMutation({
    mutationFn: async (form: LegalEntityForm) => {
      const payload = {
        name: form.name,
        countryCode: form.countryCode.toUpperCase(),
        registrationNumber: form.registrationNumber || undefined,
      };
      if (form.id) {
        return apiClient.patch(`/hr/organization/legal-entities/${form.id}`, payload);
      }
      return apiClient.post('/hr/organization/legal-entities', {
        ...payload,
        legalEntityId: crypto.randomUUID(),
      });
    },
    onSuccess: () => {
      setLegalEntityForm(emptyLegalEntity);
      refreshOrg();
    },
  });

  const saveOrgUnit = useMutation({
    mutationFn: async (form: OrgUnitForm) => {
      const payload = {
        name: form.name,
        legalEntityId: form.legalEntityId,
        parentOrgUnitId: form.parentOrgUnitId || undefined,
      };
      if (form.id) {
        return apiClient.post(`/hr/organization/org-units/${form.id}/commands/restructure`, {
          newName: form.name,
          newParentOrgUnitId: form.parentOrgUnitId || null,
        });
      }
      return apiClient.post('/hr/organization/org-units', {
        ...payload,
        orgUnitId: crypto.randomUUID(),
      });
    },
    onSuccess: () => {
      setOrgUnitForm(emptyOrgUnit);
      refreshOrg();
    },
  });

  const simulateScenario = useMutation({
    mutationFn: async (form: ScenarioForm) => unwrap<ScenarioResult>(await apiClient.post('/hr/organization/workforce-scenarios/simulate', scenarioPayload(form))),
    onMutate: () => setActionError(null),
    onError: (error) => setActionError(error),
    onSuccess: (result) => {
      setScenarioResult(result);
      setActionError(null);
    },
  });

  const activateOrgUnit = useMutation({
    mutationFn: async (unitId: string) => apiClient.post(`/hr/organization/org-units/${unitId}/commands/activate`),
    onMutate: () => setActionError(null),
    onError: (error) => setActionError(error),
    onSuccess: () => {
      setActionError(null);
      refreshOrg();
    },
  });

  const activateLegalEntity = useMutation({
    mutationFn: async (entityId: string) => apiClient.post(`/hr/organization/legal-entities/${entityId}/commands/activate`),
    onMutate: () => setActionError(null),
    onError: (error) => setActionError(error),
    onSuccess: () => {
      setActionError(null);
      refreshOrg();
    },
  });

  const deactivateLegalEntity = useMutation({
    mutationFn: async (entityId: string) => apiClient.post(`/hr/organization/legal-entities/${entityId}/commands/deactivate`),
    onMutate: () => setActionError(null),
    onError: (error) => setActionError(error),
    onSuccess: () => {
      setActionError(null);
      refreshOrg();
    },
  });

  const assignWorker = useMutation({
    mutationFn: async (form: AssignmentForm) => apiClient.patch(`/hr/organization/worker-assignments/${form.workerId}`, {
      legalEntityId: form.legalEntityId || null,
      departmentId: form.departmentId || null,
      managerId: form.managerId || null,
      jobTitle: form.jobTitle || null,
    }),
    onSuccess: () => {
      setAssignmentForm(emptyAssignment);
      refreshOrg();
      queryClient.invalidateQueries({ queryKey: ['admin-organization-workers'] });
    },
  });

  const summary = summaryQuery.data;
  const workers = Array.isArray(workersQuery.data) ? workersQuery.data : emptyWorkers;
  const orgUnits = Array.isArray(summary?.orgUnits) ? summary.orgUnits : emptyOrgUnits;
  const legalEntities = Array.isArray(summary?.legalEntities) ? summary.legalEntities : emptyLegalEntities;
  const managerRelationships = Array.isArray(summary?.managerRelationships) ? summary.managerRelationships : emptyManagerRelationships;
  const orgChart = Array.isArray(summary?.orgChart) ? summary.orgChart : emptyOrgChart;
  const planning = planningQuery.data;
  const dynamicChart = dynamicChartQuery.data;
  const reportingTree = React.useMemo(
    () => buildReportingTree(workers, managerRelationships),
    [workers, managerRelationships],
  );
  const assignedWorkerCount = workers.filter((worker) => worker.departmentId || worker.legalEntityId).length;
  const setupJourney = React.useMemo(() => buildOrganizationSetupJourney({
    assignedWorkerCount,
    legalEntityCount: legalEntities.length,
    managerRelationshipCount: managerRelationships.length,
    orgUnitCount: orgUnits.length,
    workerCount: workers.length,
  }), [assignedWorkerCount, legalEntities.length, managerRelationships.length, orgUnits.length, workers.length]);

  const legalEntityColumns = [
    { key: 'name', header: 'Entity', cell: (row: LegalEntity) => <span className="font-medium">{row.name}</span> },
    { key: 'country', header: 'Country', cell: (row: LegalEntity) => row.countryCode },
    { key: 'registration', header: 'Registration', cell: (row: LegalEntity) => row.registrationNumber || '-' },
    { key: 'status', header: 'Status', cell: (row: LegalEntity) => <Badge variant={row.status === 'ACTIVE' ? 'default' : 'outline'}>{row.status}</Badge> },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row: LegalEntity) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setLegalEntityForm({
            id: row.id,
            name: row.name,
            countryCode: row.countryCode,
            registrationNumber: row.registrationNumber ?? '',
          })}>
            Edit
          </Button>
          {row.status === 'ACTIVE' ? (
            <Button size="sm" variant="outline" onClick={() => deactivateLegalEntity.mutate(row.id)}>Deactivate</Button>
          ) : (
            <Button size="sm" onClick={() => activateLegalEntity.mutate(row.id)}>Activate</Button>
          )}
        </div>
      ),
    },
  ];

  const orgUnitColumns = [
    { key: 'name', header: 'Org Unit', cell: (row: OrgUnit) => <span className="font-medium">{row.name}</span> },
    {
      key: 'entity',
      header: 'Legal Entity',
      cell: (row: OrgUnit) => legalEntities.find((entity) => entity.id === row.legalEntityId)?.name ?? '-',
    },
    {
      key: 'parent',
      header: 'Parent',
      cell: (row: OrgUnit) => orgUnits.find((unit) => unit.id === row.parentId)?.name ?? 'Root',
    },
    { key: 'status', header: 'Status', cell: (row: OrgUnit) => <Badge variant={row.status === 'ACTIVE' ? 'default' : 'outline'}>{row.status}</Badge> },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row: OrgUnit) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setOrgUnitForm({
            id: row.id,
            name: row.name,
            legalEntityId: row.legalEntityId ?? '',
            parentOrgUnitId: row.parentId ?? '',
          })}>
            Edit
          </Button>
          {row.status !== 'ACTIVE' ? <Button size="sm" onClick={() => activateOrgUnit.mutate(row.id)}>Activate</Button> : null}
        </div>
      ),
    },
  ];

  const assignmentColumns = [
    { key: 'employee', header: 'Employee', cell: (row: Worker) => <span className="font-medium">{workerName(row)}</span> },
    { key: 'employeeId', header: 'Employee ID', cell: (row: Worker) => row.employeeId },
    { key: 'title', header: 'Job Title', cell: (row: Worker) => row.jobTitle ?? '-' },
    { key: 'entity', header: 'Entity', cell: (row: Worker) => legalEntities.find((entity) => entity.id === row.legalEntityId)?.name ?? '-' },
    { key: 'department', header: 'Department', cell: (row: Worker) => orgUnits.find((unit) => unit.id === row.departmentId)?.name ?? '-' },
    { key: 'manager', header: 'Manager', cell: (row: Worker) => workers.find((worker) => worker.id === row.managerId) ? workerName(workers.find((worker) => worker.id === row.managerId)!) : '-' },
    {
      key: 'assign',
      header: 'Assign',
      cell: (row: Worker) => (
        <Button size="sm" variant="outline" onClick={() => setAssignmentForm({
          workerId: row.id,
          legalEntityId: row.legalEntityId ?? '',
          departmentId: row.departmentId ?? '',
          managerId: row.managerId ?? '',
          jobTitle: row.jobTitle ?? '',
        })}>
          Edit Assignment
        </Button>
      ),
    },
  ];

  const managerColumns = [
    { key: 'worker', header: 'Employee', cell: (row: ManagerRelationship) => row.workerName },
    { key: 'manager', header: 'Manager', cell: (row: ManagerRelationship) => row.managerName },
    { key: 'department', header: 'Department', cell: (row: ManagerRelationship) => orgUnits.find((unit) => unit.id === row.departmentId)?.name ?? '-' },
    { key: 'primary', header: 'Primary', cell: (row: ManagerRelationship) => row.isPrimary ? 'Yes' : 'No' },
    { key: 'start', header: 'Start Date', cell: (row: ManagerRelationship) => row.startDate ? new Date(row.startDate).toLocaleDateString() : '-' },
  ];

  return (
    <div className="space-y-6 p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-white/60 bg-white/60 py-1 pl-2 pr-3 text-xs font-bold text-slate-600 backdrop-blur-md">
            <span className="relative flex h-2.5 w-2.5">
              <span className="fusion-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            Live org graph
          </div>
          <h2 className="flex items-center gap-2 font-headline text-3xl font-extrabold tracking-tight">
            <Building2 className="h-7 w-7 text-[#6366f1]" />
            <span className="fusion-gradient-text">Organization Admin</span>
          </h2>
          <p className="mt-2 text-sm text-slate-500">Create legal entities, departments, reporting lines, and employee assignments.</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {setupJourney.map((step, index) => {
          const content = (
            <div className="flex h-full min-h-[138px] flex-col justify-between rounded-[1.5rem] border border-white/70 bg-white/65 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-md">
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
              onClick={() => step.targetTab && setActiveTab(step.targetTab)}
            >
              {content}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="fusion-hover rounded-[2rem] bg-gradient-to-br from-indigo-500 to-violet-500 p-5 text-white">
          <p className="text-sm font-medium text-white/85">Legal Entities</p>
          <p className="mt-2 text-4xl font-extrabold">{legalEntities.length}</p>
        </div>
        <div className="fusion-hover rounded-[2rem] bg-gradient-to-br from-violet-500 to-purple-500 p-5 text-white">
          <p className="text-sm font-medium text-white/85">Org Units</p>
          <p className="mt-2 text-4xl font-extrabold">{orgUnits.length}</p>
        </div>
        <div className="fusion-hover rounded-[2rem] bg-gradient-to-br from-teal-500 to-emerald-500 p-5 text-white">
          <p className="text-sm font-medium text-white/85">Assigned Workers</p>
          <p className="mt-2 text-4xl font-extrabold">{assignedWorkerCount}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="fusion-glass fusion-hover rounded-[2rem] p-5">
          <p className="text-sm text-muted-foreground">Active Headcount</p>
          <p className="mt-1 text-3xl font-bold">{planning?.summary?.activeHeadcount ?? 0}</p>
        </div>
        <div className="fusion-glass fusion-hover rounded-[2rem] p-5">
          <p className="text-sm text-muted-foreground">Vacancies</p>
          <p className="mt-1 text-3xl font-bold">{planning?.summary?.vacancies ?? 0}</p>
        </div>
        <div className="fusion-glass fusion-hover rounded-[2rem] p-5">
          <p className="text-sm text-muted-foreground">Pending Demand</p>
          <p className="mt-1 text-3xl font-bold">{planning?.summary?.pendingHeadcount ?? 0}</p>
        </div>
        <div className="fusion-glass fusion-hover rounded-[2rem] p-5">
          <p className="text-sm text-muted-foreground">Annual Workforce Cost</p>
          <p className="mt-1 text-3xl font-bold">{formatMoney(planning?.workforceCostPlan?.totalAnnualCost)}</p>
        </div>
      </div>

      <ErrorMessage error={summaryQuery.error ?? workersQuery.error ?? planningQuery.error ?? dynamicChartQuery.error ?? actionError} />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as OrganizationSetupTab)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="structure">Structure</TabsTrigger>
          <TabsTrigger value="planning">Workforce Planning</TabsTrigger>
          <TabsTrigger value="entities">Legal Entities</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="assignments">Employee Assignments</TabsTrigger>
          <TabsTrigger value="managers">Manager Relationships</TabsTrigger>
        </TabsList>

        <TabsContent value="structure">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <GitBranch className="h-5 w-5" />
                Organization Chart
              </CardTitle>
              <CardDescription>Hierarchy built from real legal entities and org units.</CardDescription>
            </CardHeader>
            <CardContent>
              <OrgTree nodes={orgChart} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="planning" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(24rem,0.8fr)]">
            <Card>
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BarChart3 className="h-5 w-5" />
                    Dynamic Organization Chart
                  </CardTitle>
                  <CardDescription>Real-time workforce view by department, entity, manager, grade, location, business unit, or cost center.</CardDescription>
                </div>
                <select
                  className="h-10 rounded-lg bg-[#f1f5f9] px-3 text-sm"
                  value={chartGroupBy}
                  onChange={(event) => setChartGroupBy(event.target.value)}
                >
                  {(dynamicChart?.filters ?? ['department', 'location', 'grade', 'businessUnit', 'manager', 'costCenter', 'legalEntity']).map((filter) => (
                    <option key={filter} value={filter}>{filter}</option>
                  ))}
                </select>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {(dynamicChart?.nodes ?? []).map((node) => (
                    <div key={node.id} className="rounded-lg border bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{node.name}</p>
                          <p className="text-xs text-muted-foreground">{node.employees.length} listed employees</p>
                        </div>
                        <Badge variant={node.vacancies > 0 ? 'default' : 'outline'}>{node.vacancies} vacancies</Badge>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                        <div className="rounded-md bg-[#f1f5f9] p-2">
                          <p className="font-semibold">{node.headcount}</p>
                          <p className="text-xs text-muted-foreground">Headcount</p>
                        </div>
                        <div className="rounded-md bg-[#f1f5f9] p-2">
                          <p className="font-semibold">{node.positionCount}</p>
                          <p className="text-xs text-muted-foreground">Positions</p>
                        </div>
                        <div className="rounded-md bg-[#f1f5f9] p-2">
                          <p className="font-semibold">{formatMoney(node.annualCost)}</p>
                          <p className="text-xs text-muted-foreground">Cost</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {!dynamicChartQuery.isLoading && (dynamicChart?.nodes?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">No workforce grouping data yet. Add employees, assignments, and positions to activate the chart.</p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Brain className="h-5 w-5" />
                  Strategic Risk Dashboard
                </CardTitle>
                <CardDescription>Leadership signals from vacancies, succession, retirement, attrition, and productivity.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-[#f1f5f9] p-3">
                    <p className="text-xs text-muted-foreground">Vacancy Risk</p>
                    <p className="text-2xl font-bold">{planning?.strategicDashboard?.vacancyRiskPercent ?? 0}%</p>
                  </div>
                  <div className="rounded-lg bg-[#f1f5f9] p-3">
                    <p className="text-xs text-muted-foreground">Retirement Risk</p>
                    <p className="text-2xl font-bold">{planning?.strategicDashboard?.retirementRisk ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-[#f1f5f9] p-3">
                    <p className="text-xs text-muted-foreground">Succession Gaps</p>
                    <p className="text-2xl font-bold">{planning?.strategicDashboard?.successionGaps ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-[#f1f5f9] p-3">
                    <p className="text-xs text-muted-foreground">Critical Roles</p>
                    <p className="text-2xl font-bold">{planning?.strategicDashboard?.criticalRolesWithoutBackup ?? 0}</p>
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-semibold">Attrition Hotspots</p>
                  <div className="mt-2 space-y-2">
                    {(planning?.strategicDashboard?.attritionHotspots ?? []).slice(0, 4).map((hotspot) => (
                      <div key={hotspot.departmentId} className="flex items-center justify-between text-sm">
                        <span>{hotspot.departmentName}</span>
                        <Badge variant="outline">{hotspot.terminations}</Badge>
                      </div>
                    ))}
                    {(planning?.strategicDashboard?.attritionHotspots?.length ?? 0) === 0 ? (
                      <p className="text-sm text-muted-foreground">No termination hotspots detected.</p>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(24rem,0.9fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Network className="h-5 w-5" />
                  Headcount Planning
                </CardTitle>
                <CardDescription>Budgeted positions, vacancies, approved demand, pending requests, and forecast demand by department.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2">Department</th>
                      <th className="py-2 text-right">Current</th>
                      <th className="py-2 text-right">Positions</th>
                      <th className="py-2 text-right">Vacancies</th>
                      <th className="py-2 text-right">Pending</th>
                      <th className="py-2 text-right">Approved</th>
                      <th className="py-2 text-right">Forecast</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(planning?.headcountPlan ?? []).map((row) => (
                      <tr key={row.departmentId} className="border-b last:border-0">
                        <td className="py-3 font-medium">{row.departmentName}</td>
                        <td className="py-3 text-right">{row.currentHeadcount}</td>
                        <td className="py-3 text-right">{row.approvedPositions}</td>
                        <td className="py-3 text-right">{row.vacancies}</td>
                        <td className="py-3 text-right">{row.pendingRequests}</td>
                        <td className="py-3 text-right">{row.approvedRequests}</td>
                        <td className="py-3 text-right font-semibold">{row.forecastDemand}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!planningQuery.isLoading && (planning?.headcountPlan?.length ?? 0) === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">No headcount plan rows yet.</p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calculator className="h-5 w-5" />
                  Workforce Cost Plan
                </CardTitle>
                <CardDescription>Salary, benefits, statutory cost, overtime, allowances, relocation, training, and contractor cost.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  ['Salary', planning?.workforceCostPlan?.salary],
                  ['Benefits', planning?.workforceCostPlan?.benefits],
                  ['Social insurance and tax', planning?.workforceCostPlan?.socialInsuranceAndTax],
                  ['Overtime', planning?.workforceCostPlan?.overtime],
                  ['Allowances, travel, relocation', planning?.workforceCostPlan?.allowancesTravelRelocation],
                  ['Training', planning?.workforceCostPlan?.training],
                  ['Contractors', planning?.workforceCostPlan?.contractorCost],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex items-center justify-between border-b pb-2 text-sm last:border-0">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold">{formatMoney(Number(value ?? 0))}</span>
                  </div>
                ))}
                <div className="rounded-lg bg-primary/10 p-3">
                  <p className="text-sm text-muted-foreground">Total Annual Cost</p>
                  <p className="text-2xl font-bold text-primary">{formatMoney(planning?.workforceCostPlan?.totalAnnualCost)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5" />
                  AI Forecast
                </CardTitle>
                <CardDescription>12, 24, and 36 month workforce demand projection.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(planning?.aiForecast ?? []).map((forecast) => (
                  <div key={forecast.horizonMonths} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{forecast.horizonMonths} months</p>
                      <Badge variant="outline">{forecast.confidence}</Badge>
                    </div>
                    <p className="mt-2 text-2xl font-bold">{forecast.forecastHeadcountDemand}</p>
                    <p className="text-sm text-muted-foreground">{forecast.deltaFromToday >= 0 ? '+' : ''}{forecast.deltaFromToday} from today</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Skills Gap Planning</CardTitle>
                <CardDescription>Compares current workforce capabilities with future position demand.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(planning?.skillsGap ?? []).slice(0, 8).map((gap) => (
                  <div key={gap.skill} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{gap.skill}</p>
                      <Badge variant={gap.severity === 'HIGH' ? 'destructive' : gap.severity === 'MEDIUM' ? 'default' : 'outline'}>{gap.severity}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">Required {gap.required} / available {gap.available} / gap {gap.gap}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Scenario Simulator</CardTitle>
                <CardDescription>Model branch expansion, demand growth, reduction, outsourcing, automation, and AI-agent capacity.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={(event) => {
                  event.preventDefault();
                  simulateScenario.mutate(scenarioForm);
                }}>
                  <div className="space-y-2">
                    <Label htmlFor="scenario-name">Scenario</Label>
                    <Input id="scenario-name" value={scenarioForm.name} onChange={(event) => setScenarioForm({ ...scenarioForm, name: event.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ['Branches', 'branchExpansionCount'],
                      ['Roles / branch', 'rolesPerBranch'],
                      ['Demand %', 'demandGrowthPercent'],
                      ['Admin cut %', 'adminReductionPercent'],
                      ['Outsource', 'outsourceHeadcount'],
                      ['Automation %', 'automationOffsetPercent'],
                      ['AI capacity', 'aiAgentCapacity'],
                      ['Cost / FTE', 'averageCostPerFte'],
                    ].map(([label, key]) => (
                      <div key={key} className="space-y-2">
                        <Label htmlFor={`scenario-${key}`}>{label}</Label>
                        <Input
                          id={`scenario-${key}`}
                          min="0"
                          type="number"
                          value={scenarioForm[key as keyof ScenarioForm]}
                          onChange={(event) => setScenarioForm({ ...scenarioForm, [key]: event.target.value })}
                        />
                      </div>
                    ))}
                  </div>
                  <Button type="submit" disabled={simulateScenario.isPending}>
                    Run Scenario
                  </Button>
                  <ErrorMessage error={simulateScenario.error} />
                </form>
                {scenarioResult ? (
                  <div className="mt-4 rounded-lg border bg-[#f1f5f9] p-4">
                    <p className="text-sm font-semibold">{scenarioResult.name}</p>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Projected Headcount</p>
                        <p className="text-xl font-bold">{scenarioResult.projected.headcount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Cost Delta</p>
                        <p className="text-xl font-bold">{formatMoney(scenarioResult.projected.costDelta)}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{scenarioResult.recommendation}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="entities" className="grid gap-4 lg:grid-cols-[22rem_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{legalEntityForm.id ? 'Edit Legal Entity' : 'Add Legal Entity'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={(event) => {
                event.preventDefault();
                saveLegalEntity.mutate(legalEntityForm);
              }}>
                <div className="space-y-2">
                  <Label htmlFor="entity-name">Name</Label>
                  <Input id="entity-name" value={legalEntityForm.name} onChange={(event) => setLegalEntityForm({ ...legalEntityForm, name: event.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country-code">Country Code</Label>
                  <Input id="country-code" maxLength={2} value={legalEntityForm.countryCode} onChange={(event) => setLegalEntityForm({ ...legalEntityForm, countryCode: event.target.value.toUpperCase() })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registration">Registration Number</Label>
                  <Input id="registration" value={legalEntityForm.registrationNumber} onChange={(event) => setLegalEntityForm({ ...legalEntityForm, registrationNumber: event.target.value })} />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={saveLegalEntity.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                  {legalEntityForm.id ? <Button type="button" variant="outline" onClick={() => setLegalEntityForm(emptyLegalEntity)}>Clear</Button> : null}
                </div>
                <ErrorMessage error={saveLegalEntity.error} />
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Legal Entities</CardTitle>
              <CardDescription>Registered operating companies and countries.</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable columns={legalEntityColumns} data={legalEntities} keyExtractor={(row) => row.id} isLoading={summaryQuery.isLoading} emptyMessage="No legal entities created" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departments" className="grid gap-4 lg:grid-cols-[22rem_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{orgUnitForm.id ? 'Edit Department / Team' : 'Add Department / Team'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={(event) => {
                event.preventDefault();
                saveOrgUnit.mutate(orgUnitForm);
              }}>
                <div className="space-y-2">
                  <Label htmlFor="unit-name">Name</Label>
                  <Input id="unit-name" value={orgUnitForm.name} onChange={(event) => setOrgUnitForm({ ...orgUnitForm, name: event.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit-entity">Legal Entity</Label>
                  <select id="unit-entity" className="h-10 w-full rounded-lg bg-[#f1f5f9] px-3 text-sm" value={orgUnitForm.legalEntityId} onChange={(event) => setOrgUnitForm({ ...orgUnitForm, legalEntityId: event.target.value })} required>
                    <option value="">Select entity</option>
                    {legalEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parent-unit">Parent Unit</Label>
                  <select id="parent-unit" className="h-10 w-full rounded-lg bg-[#f1f5f9] px-3 text-sm" value={orgUnitForm.parentOrgUnitId} onChange={(event) => setOrgUnitForm({ ...orgUnitForm, parentOrgUnitId: event.target.value })}>
                    <option value="">Root department</option>
                    {orgUnits.filter((unit) => unit.id !== orgUnitForm.id).map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={saveOrgUnit.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                  {orgUnitForm.id ? <Button type="button" variant="outline" onClick={() => setOrgUnitForm(emptyOrgUnit)}>Clear</Button> : null}
                </div>
                <ErrorMessage error={saveOrgUnit.error} />
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Departments and Teams</CardTitle>
              <CardDescription>Hierarchical org units under legal entities.</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable columns={orgUnitColumns} data={orgUnits} keyExtractor={(row) => row.id} isLoading={summaryQuery.isLoading} emptyMessage="No departments or teams created" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="grid gap-4 lg:grid-cols-[24rem_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserCog className="h-5 w-5" />
                Assign Employee
              </CardTitle>
              <CardDescription>Assign a worker to entity, department, manager, and title.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={(event) => {
                event.preventDefault();
                assignWorker.mutate(assignmentForm);
              }}>
                <div className="space-y-2">
                  <Label htmlFor="assignment-worker">Employee</Label>
                  <select id="assignment-worker" className="h-10 w-full rounded-lg bg-[#f1f5f9] px-3 text-sm" value={assignmentForm.workerId} onChange={(event) => setAssignmentForm({ ...assignmentForm, workerId: event.target.value })} required>
                    <option value="">Select employee</option>
                    {workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.employeeId} · {workerName(worker)}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assignment-title">Job Title</Label>
                  <Input id="assignment-title" value={assignmentForm.jobTitle} onChange={(event) => setAssignmentForm({ ...assignmentForm, jobTitle: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assignment-entity">Legal Entity</Label>
                  <select id="assignment-entity" className="h-10 w-full rounded-lg bg-[#f1f5f9] px-3 text-sm" value={assignmentForm.legalEntityId} onChange={(event) => setAssignmentForm({ ...assignmentForm, legalEntityId: event.target.value })}>
                    <option value="">No entity</option>
                    {legalEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assignment-department">Department / Team</Label>
                  <select id="assignment-department" className="h-10 w-full rounded-lg bg-[#f1f5f9] px-3 text-sm" value={assignmentForm.departmentId} onChange={(event) => setAssignmentForm({ ...assignmentForm, departmentId: event.target.value })}>
                    <option value="">No department</option>
                    {orgUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assignment-manager">Manager</Label>
                  <select id="assignment-manager" className="h-10 w-full rounded-lg bg-[#f1f5f9] px-3 text-sm" value={assignmentForm.managerId} onChange={(event) => setAssignmentForm({ ...assignmentForm, managerId: event.target.value })}>
                    <option value="">No manager</option>
                    {workers.filter((worker) => worker.id !== assignmentForm.workerId).map((worker) => <option key={worker.id} value={worker.id}>{workerName(worker)}</option>)}
                  </select>
                </div>
                <Button type="submit" disabled={assignWorker.isPending || !assignmentForm.workerId}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Assignment
                </Button>
                <ErrorMessage error={assignWorker.error} />
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Employee Organization Assignments</CardTitle>
              <CardDescription>Real worker assignments, not just setup dropdown values.</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable columns={assignmentColumns} data={workers} keyExtractor={(row) => row.id} isLoading={workersQuery.isLoading} emptyMessage="No workers found" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="managers" className="grid gap-4 xl:grid-cols-[minmax(22rem,0.9fr)_minmax(32rem,1.1fr)]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Network className="h-5 w-5" />
                Reporting Tree
              </CardTitle>
              <CardDescription>Employee-to-manager hierarchy built from active reporting lines.</CardDescription>
            </CardHeader>
            <CardContent>
              <ReportingTree nodes={reportingTree} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Manager Relationships</CardTitle>
              <CardDescription>Active reporting lines created from employee assignments.</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable columns={managerColumns} data={managerRelationships} keyExtractor={(row) => row.id} isLoading={summaryQuery.isLoading} emptyMessage="No manager relationships created" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
