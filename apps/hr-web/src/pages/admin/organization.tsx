import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ModuleConfigureLauncher } from '@/components/common/module-configure-launcher';
import { buildOrganizationSetupJourney, type OrganizationSetupTab } from '@/lib/organization-setup-journey';
import { BarChart3, Brain, Calculator, GitBranch, Network, Sparkles } from 'lucide-react';
import { OrgTree } from './organization/organization-trees';
import { OrganizationSummaryHeader } from './organization/organization-summary';
import { HeadcountTab, PositionsTab, VacanciesTab } from './organization/position-control-tabs';
import { AssignmentsTab, DepartmentsTab, LegalEntitiesTab, ManagerRelationshipsTab } from './organization/organization-setup-tabs';

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

type PositionControlPosition = {
  id: string;
  positionCode: string;
  title: string;
  status: string;
  departmentId?: string | null;
  legalEntityId?: string | null;
  employmentType?: string | null;
  jobFamily?: string | null;
  jobLevel?: string | null;
  filledByWorkerId?: string | null;
  headcountRequestId?: string | null;
};

type PositionAllowedActionsResponse = {
  allowedActions: string[];
  currentState: string;
  positionId: string;
};

type HeadcountRequest = {
  id: string;
  requestNumber: string;
  status: string;
  justification?: string;
  requestedBy: string;
  positionsRequested: number;
  positionsApproved?: number | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
};

type PositionForm = {
  departmentId: string;
  employmentType: string;
  jobFamily: string;
  jobLevel: string;
  legalEntityId: string;
  positionCode: string;
  title: string;
};

type HeadcountForm = {
  departmentId: string;
  justification: string;
  legalEntityId: string;
  requestedPositions: string;
};

const emptyLegalEntity: LegalEntityForm = { name: '', countryCode: 'EG', registrationNumber: '' };
const emptyOrgUnit: OrgUnitForm = { name: '', legalEntityId: '', parentOrgUnitId: '' };
const emptyAssignment: AssignmentForm = { workerId: '', legalEntityId: '', departmentId: '', managerId: '', jobTitle: '' };
const emptyPosition: PositionForm = {
  departmentId: '',
  employmentType: 'FULL_TIME',
  jobFamily: '',
  jobLevel: '',
  legalEntityId: '',
  positionCode: '',
  title: '',
};
const emptyHeadcount: HeadcountForm = {
  departmentId: '',
  justification: '',
  legalEntityId: '',
  requestedPositions: '1',
};
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
const emptyPositions: PositionControlPosition[] = [];
const emptyHeadcountRequests: HeadcountRequest[] = [];

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

const positionCommandRoutes: Record<string, string> = {
  Activate: 'activate',
  Close: 'close',
  Freeze: 'freeze',
  Unfreeze: 'unfreeze',
};

function normalizePositionId(position: PositionControlPosition): string {
  if (typeof position.id === 'string') return position.id;
  const maybeValue = (position.id as unknown as { value?: unknown })?.value;
  return typeof maybeValue === 'string' ? maybeValue : '';
}

function PositionLifecycleActions({
  onCommand,
  position,
}: {
  onCommand: (input: { command: string; positionId: string }) => void;
  position: PositionControlPosition;
}) {
  const positionId = normalizePositionId(position);
  const allowedActionsQuery = useQuery({
    enabled: Boolean(positionId),
    queryKey: ['admin-position-control-position-actions', positionId],
    queryFn: async () => unwrap<PositionAllowedActionsResponse>(await apiClient.get(`/hr/position-control/positions/${positionId}/allowed-actions`)),
    staleTime: 30 * 1000,
  });

  const allowedActions = allowedActionsQuery.data?.allowedActions ?? [];
  if (allowedActions.length === 0) {
    return <span className="text-xs text-muted-foreground">No actions</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {allowedActions.map((action) => {
        const route = positionCommandRoutes[action];
        return (
          <Button
            key={action}
            disabled={!route}
            size="sm"
            variant={action === 'Activate' ? 'default' : 'outline'}
            onClick={() => route && onCommand({ command: route, positionId })}
          >
            {action}
          </Button>
        );
      })}
    </div>
  );
}

function HeadcountLifecycleActions({
  onCommand,
  request,
}: {
  onCommand: (input: { command: string; payload?: Record<string, unknown>; requestId: string }) => void;
  request: HeadcountRequest;
}) {
  const actions: Array<{ command: string; label: string; payload?: Record<string, unknown>; variant?: 'default' | 'outline' }> = [];

  if (request.status === 'SUBMITTED') {
    actions.push({ command: 'start-review', label: 'Start Review' });
  }
  if (request.status === 'UNDER_REVIEW') {
    actions.push({
      command: 'approve',
      label: 'Approve',
      payload: { positionsApproved: Math.max(request.positionsApproved ?? request.positionsRequested, 1) },
    });
    actions.push({
      command: 'reject',
      label: 'Reject',
      payload: { reason: 'Rejected from organization admin' },
      variant: 'outline',
    });
  }
  if (request.status === 'DRAFT' || request.status === 'SUBMITTED') {
    actions.push({ command: 'cancel', label: 'Cancel', variant: 'outline' });
  }

  if (actions.length === 0) {
    return <span className="text-xs text-muted-foreground">No actions</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action.command}
          size="sm"
          variant={action.variant ?? 'default'}
          onClick={() => onCommand({ command: action.command, payload: action.payload, requestId: request.id })}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}

export function AdminOrganization({ initialTab = 'structure' }: { initialTab?: string }) {
  const queryClient = useQueryClient();
  const [legalEntityForm, setLegalEntityForm] = React.useState<LegalEntityForm>(emptyLegalEntity);
  const [orgUnitForm, setOrgUnitForm] = React.useState<OrgUnitForm>(emptyOrgUnit);
  const [assignmentForm, setAssignmentForm] = React.useState<AssignmentForm>(emptyAssignment);
  const [positionForm, setPositionForm] = React.useState<PositionForm>(emptyPosition);
  const [headcountForm, setHeadcountForm] = React.useState<HeadcountForm>(emptyHeadcount);
  const [activeTab, setActiveTab] = React.useState<OrganizationSetupTab>(initialTab as OrganizationSetupTab);
  const [chartGroupBy, setChartGroupBy] = React.useState('department');
  const [scenarioForm, setScenarioForm] = React.useState<ScenarioForm>(emptyScenario);
  const [scenarioResult, setScenarioResult] = React.useState<ScenarioResult | null>(null);
  const [actionError, setActionError] = React.useState<unknown>(null);

  const summaryQuery = useQuery({
    queryKey: ['admin-organization-summary'],
    queryFn: async () => unwrap<OrganizationSummary>(await apiClient.get('/hr/organization/summary')),
  });

  const legalEntitiesQuery = useQuery({
    queryKey: ['admin-organization-legal-entities'],
    queryFn: async () => unwrap<LegalEntity[]>(await apiClient.get('/hr/organization/legal-entities')),
  });

  const orgUnitsQuery = useQuery({
    queryKey: ['admin-organization-org-units'],
    queryFn: async () => unwrap<OrgUnit[]>(await apiClient.get('/hr/organization/org-units')),
  });

  const orgUnitTreeQuery = useQuery({
    queryKey: ['admin-organization-org-unit-tree'],
    queryFn: async () => unwrap<OrgUnit[]>(await apiClient.get('/hr/organization/org-units/tree')),
  });

  const legalEntityDetailQuery = useQuery({
    enabled: Boolean(legalEntityForm.id),
    queryKey: ['admin-organization-legal-entity-detail', legalEntityForm.id],
    queryFn: async () => unwrap<LegalEntity>(await apiClient.get(`/hr/organization/legal-entities/${legalEntityForm.id}`)),
  });

  const orgUnitDetailQuery = useQuery({
    enabled: Boolean(orgUnitForm.id),
    queryKey: ['admin-organization-org-unit-detail', orgUnitForm.id],
    queryFn: async () => unwrap<OrgUnit>(await apiClient.get(`/hr/organization/org-units/${orgUnitForm.id}`)),
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

  const positionsQuery = useQuery({
    queryKey: ['admin-position-control-positions'],
    queryFn: async () => unwrap<PositionControlPosition[]>(await apiClient.get('/hr/position-control/positions')),
  });

  const vacantPositionsQuery = useQuery({
    queryKey: ['admin-position-control-vacant'],
    queryFn: async () => unwrap<PositionControlPosition[]>(await apiClient.get('/hr/position-control/positions/vacant')),
  });

  const headcountRequestsQuery = useQuery({
    queryKey: ['admin-position-control-headcount-requests'],
    queryFn: async () => unwrap<HeadcountRequest[]>(await apiClient.get('/hr/position-control/headcount-requests')),
  });

  const refreshOrg = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-organization-summary'] });
    queryClient.invalidateQueries({ queryKey: ['admin-organization-legal-entities'] });
    queryClient.invalidateQueries({ queryKey: ['admin-organization-org-units'] });
    queryClient.invalidateQueries({ queryKey: ['admin-organization-org-unit-tree'] });
    queryClient.invalidateQueries({ queryKey: ['admin-workforce-planning'] });
    queryClient.invalidateQueries({ queryKey: ['admin-workforce-org-chart'] });
  };

  const refreshPositionControl = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-position-control-positions'] });
    queryClient.invalidateQueries({ queryKey: ['admin-position-control-vacant'] });
    queryClient.invalidateQueries({ queryKey: ['admin-position-control-headcount-requests'] });
    queryClient.invalidateQueries({ queryKey: ['admin-position-control-position-actions'] });
    refreshOrg();
  };

  React.useEffect(() => {
    const entity = legalEntityDetailQuery.data;
    if (!entity || legalEntityForm.id !== entity.id) return;
    setLegalEntityForm({
      id: entity.id,
      name: entity.name,
      countryCode: entity.countryCode,
      registrationNumber: entity.registrationNumber ?? '',
    });
  }, [legalEntityDetailQuery.data, legalEntityForm.id]);

  React.useEffect(() => {
    const unit = orgUnitDetailQuery.data;
    if (!unit || orgUnitForm.id !== unit.id) return;
    setOrgUnitForm({
      id: unit.id,
      name: unit.name,
      legalEntityId: unit.legalEntityId ?? '',
      parentOrgUnitId: unit.parentId ?? '',
    });
  }, [orgUnitDetailQuery.data, orgUnitForm.id]);

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

  const createPosition = useMutation({
    mutationFn: async (form: PositionForm) => apiClient.post('/hr/position-control/positions', {
      departmentId: form.departmentId || undefined,
      employmentType: form.employmentType,
      jobFamily: form.jobFamily || undefined,
      jobLevel: form.jobLevel || undefined,
      legalEntityId: form.legalEntityId || undefined,
      positionCode: form.positionCode,
      title: form.title,
    }),
    onMutate: () => setActionError(null),
    onError: (error) => setActionError(error),
    onSuccess: () => {
      setPositionForm(emptyPosition);
      setActionError(null);
      refreshPositionControl();
    },
  });

  const submitHeadcountRequest = useMutation({
    mutationFn: async (form: HeadcountForm) => apiClient.post('/hr/position-control/headcount-requests', {
      departmentId: form.departmentId || undefined,
      justification: form.justification,
      legalEntityId: form.legalEntityId || undefined,
      requestedPositions: Math.max(numberOrUndefined(form.requestedPositions) ?? 1, 1),
    }),
    onMutate: () => setActionError(null),
    onError: (error) => setActionError(error),
    onSuccess: () => {
      setHeadcountForm(emptyHeadcount);
      setActionError(null);
      refreshPositionControl();
    },
  });

  const runPositionCommand = useMutation({
    mutationFn: async ({ command, positionId }: { command: string; positionId: string }) =>
      apiClient.post(`/hr/position-control/positions/${positionId}/commands/${command}`, {}),
    onMutate: () => setActionError(null),
    onError: (error) => setActionError(error),
    onSuccess: () => {
      setActionError(null);
      refreshPositionControl();
    },
  });

  const runHeadcountCommand = useMutation({
    mutationFn: async ({ command, payload, requestId }: { command: string; payload?: Record<string, unknown>; requestId: string }) =>
      apiClient.post(`/hr/position-control/headcount-requests/${requestId}/commands/${command}`, payload ?? {}),
    onMutate: () => setActionError(null),
    onError: (error) => setActionError(error),
    onSuccess: () => {
      setActionError(null);
      refreshPositionControl();
    },
  });

  const summary = summaryQuery.data;
  const workers = Array.isArray(workersQuery.data) ? workersQuery.data : emptyWorkers;
  const orgUnits = Array.isArray(orgUnitsQuery.data)
    ? orgUnitsQuery.data
    : Array.isArray(summary?.orgUnits) ? summary.orgUnits : emptyOrgUnits;
  const legalEntities = Array.isArray(legalEntitiesQuery.data)
    ? legalEntitiesQuery.data
    : Array.isArray(summary?.legalEntities) ? summary.legalEntities : emptyLegalEntities;
  const managerRelationships = Array.isArray(summary?.managerRelationships) ? summary.managerRelationships : emptyManagerRelationships;
  const orgChart = Array.isArray(orgUnitTreeQuery.data)
    ? orgUnitTreeQuery.data
    : Array.isArray(summary?.orgChart) ? summary.orgChart : emptyOrgChart;
  const planning = planningQuery.data;
  const dynamicChart = dynamicChartQuery.data;
  const positions = Array.isArray(positionsQuery.data) ? positionsQuery.data : emptyPositions;
  const vacantPositions = Array.isArray(vacantPositionsQuery.data) ? vacantPositionsQuery.data : emptyPositions;
  const headcountRequests = Array.isArray(headcountRequestsQuery.data) ? headcountRequestsQuery.data : emptyHeadcountRequests;
  const positionStatusCounts = React.useMemo(() => positions.reduce<Record<string, number>>((acc, position) => {
    acc[position.status] = (acc[position.status] ?? 0) + 1;
    return acc;
  }, {}), [positions]);
  const approvedHeadcountRequests = React.useMemo(
    () => headcountRequests.filter((request) => request.status === 'APPROVED'),
    [headcountRequests],
  );
  const approvedSagaPositionCount = approvedHeadcountRequests.reduce((total, request) => total + (request.positionsApproved ?? 0), 0);
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

  const positionColumns = [
    { key: 'code', header: 'Position', cell: (row: PositionControlPosition) => <span className="font-medium">{row.positionCode}</span> },
    { key: 'title', header: 'Title', cell: (row: PositionControlPosition) => row.title },
    { key: 'department', header: 'Department', cell: (row: PositionControlPosition) => orgUnits.find((unit) => unit.id === row.departmentId)?.name ?? row.departmentId ?? '-' },
    { key: 'entity', header: 'Entity', cell: (row: PositionControlPosition) => legalEntities.find((entity) => entity.id === row.legalEntityId)?.name ?? row.legalEntityId ?? '-' },
    { key: 'employment', header: 'Type', cell: (row: PositionControlPosition) => row.employmentType ?? '-' },
    { key: 'status', header: 'Status', cell: (row: PositionControlPosition) => <Badge variant={row.status === 'ACTIVE' || row.status === 'FILLED' ? 'default' : 'outline'}>{row.status}</Badge> },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row: PositionControlPosition) => (
        <PositionLifecycleActions
          onCommand={(input) => runPositionCommand.mutate(input)}
          position={row}
        />
      ),
    },
  ];

  const vacancyColumns = [
    { key: 'code', header: 'Position', cell: (row: PositionControlPosition) => <span className="font-medium">{row.positionCode}</span> },
    { key: 'title', header: 'Title', cell: (row: PositionControlPosition) => row.title },
    { key: 'department', header: 'Department', cell: (row: PositionControlPosition) => orgUnits.find((unit) => unit.id === row.departmentId)?.name ?? row.departmentId ?? '-' },
    { key: 'source', header: 'Source', cell: (row: PositionControlPosition) => row.headcountRequestId ? 'Approved headcount' : 'Manual position' },
    { key: 'status', header: 'Status', cell: (row: PositionControlPosition) => <Badge variant="outline">{row.status}</Badge> },
  ];

  const headcountColumns = [
    { key: 'request', header: 'Request', cell: (row: HeadcountRequest) => <span className="font-medium">{row.requestNumber}</span> },
    { key: 'requested', header: 'Requested', cell: (row: HeadcountRequest) => row.positionsRequested },
    { key: 'approved', header: 'Approved', cell: (row: HeadcountRequest) => row.positionsApproved ?? '-' },
    { key: 'status', header: 'Status', cell: (row: HeadcountRequest) => <Badge variant={row.status === 'APPROVED' ? 'default' : row.status === 'REJECTED' ? 'destructive' : 'outline'}>{row.status}</Badge> },
    { key: 'saga', header: 'Saga Output', cell: (row: HeadcountRequest) => row.status === 'APPROVED' && row.positionsApproved ? `${row.positionsApproved} positions auto-created when approved` : 'Waiting for approval' },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row: HeadcountRequest) => (
        <HeadcountLifecycleActions
          onCommand={(input) => runHeadcountCommand.mutate(input)}
          request={row}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6 p-5">
      <OrganizationSummaryHeader
        activeHeadcount={planning?.summary?.activeHeadcount ?? 0}
        assignedWorkerCount={assignedWorkerCount}
        legalEntityCount={legalEntities.length}
        onTabChange={setActiveTab}
        orgUnitCount={orgUnits.length}
        pendingHeadcount={planning?.summary?.pendingHeadcount ?? 0}
        setupJourney={setupJourney}
        totalAnnualCost={formatMoney(planning?.workforceCostPlan?.totalAnnualCost)}
        vacancies={planning?.summary?.vacancies ?? 0}
      />

      <ErrorMessage error={
        summaryQuery.error
        ?? workersQuery.error
        ?? planningQuery.error
        ?? dynamicChartQuery.error
        ?? positionsQuery.error
        ?? vacantPositionsQuery.error
        ?? headcountRequestsQuery.error
        ?? actionError
      } />

      <ModuleConfigureLauncher
        moduleName="Organization"
        approvalCommandKeyword="Organization"
        fieldAccessEntity="organization"
      />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as OrganizationSetupTab)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="structure">Structure</TabsTrigger>
          <TabsTrigger value="planning">Workforce Planning</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="vacancies">Vacancies</TabsTrigger>
          <TabsTrigger value="headcount">Headcount</TabsTrigger>
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
                  className="h-10 rounded-lg bg-muted px-3 text-sm"
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
                        <div className="rounded-md bg-muted p-2">
                          <p className="font-semibold">{node.headcount}</p>
                          <p className="text-xs text-muted-foreground">Headcount</p>
                        </div>
                        <div className="rounded-md bg-muted p-2">
                          <p className="font-semibold">{node.positionCount}</p>
                          <p className="text-xs text-muted-foreground">Positions</p>
                        </div>
                        <div className="rounded-md bg-muted p-2">
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
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Vacancy Risk</p>
                    <p className="text-2xl font-bold">{planning?.strategicDashboard?.vacancyRiskPercent ?? 0}%</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Retirement Risk</p>
                    <p className="text-2xl font-bold">{planning?.strategicDashboard?.retirementRisk ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Succession Gaps</p>
                    <p className="text-2xl font-bold">{planning?.strategicDashboard?.successionGaps ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
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
                <table className="w-full min-w-[720px] text-start text-sm">
                  <thead className="border-b text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2">Department</th>
                      <th className="py-2 text-end">Current</th>
                      <th className="py-2 text-end">Positions</th>
                      <th className="py-2 text-end">Vacancies</th>
                      <th className="py-2 text-end">Pending</th>
                      <th className="py-2 text-end">Approved</th>
                      <th className="py-2 text-end">Forecast</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(planning?.headcountPlan ?? []).map((row) => (
                      <tr key={row.departmentId} className="border-b last:border-0">
                        <td className="py-3 font-medium">{row.departmentName}</td>
                        <td className="py-3 text-end">{row.currentHeadcount}</td>
                        <td className="py-3 text-end">{row.approvedPositions}</td>
                        <td className="py-3 text-end">{row.vacancies}</td>
                        <td className="py-3 text-end">{row.pendingRequests}</td>
                        <td className="py-3 text-end">{row.approvedRequests}</td>
                        <td className="py-3 text-end font-semibold">{row.forecastDemand}</td>
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
                  <div className="mt-4 rounded-lg border bg-muted p-4">
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

        <TabsContent value="positions">
          <PositionsTab
            createError={<ErrorMessage error={createPosition.error} />}
            isCreating={createPosition.isPending}
            isLoading={positionsQuery.isLoading}
            legalEntities={legalEntities}
            onCreate={() => createPosition.mutate(positionForm)}
            onFormChange={setPositionForm}
            orgUnits={orgUnits}
            positionColumns={positionColumns}
            positionForm={positionForm}
            positionKeyExtractor={normalizePositionId}
            positionStatusCounts={positionStatusCounts}
            positions={positions}
          />
        </TabsContent>

        <TabsContent value="vacancies">
          <VacanciesTab
            isLoading={vacantPositionsQuery.isLoading}
            positionKeyExtractor={normalizePositionId}
            vacancyColumns={vacancyColumns}
            vacantPositions={vacantPositions}
          />
        </TabsContent>

        <TabsContent value="headcount">
          <HeadcountTab
            approvedHeadcountRequests={approvedHeadcountRequests}
            approvedSagaPositionCount={approvedSagaPositionCount}
            headcountColumns={headcountColumns}
            headcountError={<ErrorMessage error={submitHeadcountRequest.error} />}
            headcountForm={headcountForm}
            headcountRequests={headcountRequests}
            isLoading={headcountRequestsQuery.isLoading}
            isSubmitting={submitHeadcountRequest.isPending}
            legalEntities={legalEntities}
            onFormChange={setHeadcountForm}
            onSubmit={() => submitHeadcountRequest.mutate(headcountForm)}
            orgUnits={orgUnits}
          />
        </TabsContent>

        <TabsContent value="entities">
          <LegalEntitiesTab
            emptyLegalEntity={emptyLegalEntity}
            form={legalEntityForm}
            formError={<ErrorMessage error={saveLegalEntity.error} />}
            isLoading={legalEntitiesQuery.isLoading || summaryQuery.isLoading}
            isSaving={saveLegalEntity.isPending}
            legalEntities={legalEntities}
            legalEntityColumns={legalEntityColumns}
            onClear={setLegalEntityForm}
            onFormChange={setLegalEntityForm}
            onSave={() => saveLegalEntity.mutate(legalEntityForm)}
          />
        </TabsContent>

        <TabsContent value="departments">
          <DepartmentsTab
            emptyOrgUnit={emptyOrgUnit}
            form={orgUnitForm}
            formError={<ErrorMessage error={saveOrgUnit.error} />}
            isLoading={orgUnitsQuery.isLoading || summaryQuery.isLoading}
            isSaving={saveOrgUnit.isPending}
            legalEntities={legalEntities}
            onClear={setOrgUnitForm}
            onFormChange={setOrgUnitForm}
            onSave={() => saveOrgUnit.mutate(orgUnitForm)}
            orgUnitColumns={orgUnitColumns}
            orgUnits={orgUnits}
          />
        </TabsContent>

        <TabsContent value="assignments">
          <AssignmentsTab
            assignmentColumns={assignmentColumns}
            form={assignmentForm}
            formError={<ErrorMessage error={assignWorker.error} />}
            isLoading={workersQuery.isLoading}
            isSaving={assignWorker.isPending}
            legalEntities={legalEntities}
            onFormChange={setAssignmentForm}
            onSave={() => assignWorker.mutate(assignmentForm)}
            orgUnits={orgUnits}
            workerLabel={(worker) => `${worker.employeeId} · ${workerName(worker)}`}
            workers={workers}
          />
        </TabsContent>

        <TabsContent value="managers">
          <ManagerRelationshipsTab
            isLoading={summaryQuery.isLoading}
            managerColumns={managerColumns}
            managerRelationships={managerRelationships}
            reportingTree={reportingTree}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
