import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  BellRing,
  Clock3,
  Database,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  RefreshCcw,
  Save,
  ShieldAlert,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiClient } from '@/lib/api-client';
import { BusinessMetric, BusinessPageHeader, SectionHeading } from '@/components/common/business-page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/common/error-state';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { generateUUID } from '@/lib/utils';
import { useUIStore } from '@/stores/ui-store';

type HrReportReadiness = 'Live' | 'Attention' | 'No Data';

type HrReportGroup = {
  code: string;
  title: string;
  category: string;
  services?: string[];
  serviceUsageLinks?: string[];
  analyticsOutputs?: string[];
  template?: {
    module: string;
    columns: string[];
    exportArtifact: string;
  };
  brain?: {
    engine: string;
    nervousSystem: string;
  };
  activity: number;
  commands: number;
  events: number;
  notifications: number;
  workflowTransitions: number;
  queueBacklog: number;
  issues: number;
  readiness: HrReportReadiness;
  lastActivityAt?: string;
  chartData: Array<{ label: string; value: number }>;
};

type HrReportsDashboard = {
  generatedAt: string;
  totals: {
    reportGroups: number;
    activeReportGroups: number;
    totalActivity: number;
    queueBacklog: number;
    issues: number;
  };
  reports: HrReportGroup[];
  activityByReport: Array<{ label: string; activity: number; issues: number }>;
};

type HrAnalyticsMetric = {
  label: string;
  value: number;
  unit?: 'days' | 'hours' | 'currency' | 'rating';
  currency?: string;
};

type HrAnalyticsModule = {
  code: string;
  title: string;
  category: string;
  primary: HrAnalyticsMetric;
  secondary: HrAnalyticsMetric;
  risk: HrAnalyticsMetric;
  chart: {
    type: 'bar';
    data: Array<{ label: string; value: number; secondaryValue?: number }>;
  };
  lastActivityAt?: string;
};

type HrAnalyticsDashboard = {
  generatedAt: string;
  totals: {
    activeModules: number;
    riskSignals: number;
    attendanceEmployeeDays: number;
    leaveRequests: number;
    payrollNetPay: number;
    performanceReviews: number;
    benefitsEnrollments: number;
    headcountPositions?: number;
    complianceAcknowledgements?: number;
    serviceCases?: number;
  };
  headlineMetrics: HrAnalyticsMetric[];
  modules: HrAnalyticsModule[];
  riskSignals: Array<{ label: string; value: number }>;
};

type ReportingFieldType = 'text' | 'number' | 'date' | 'currency' | 'status' | 'percentage';

type ReportingFieldCatalogItem = {
  code: string;
  label: string;
  type: ReportingFieldType;
  defaultSelected?: boolean;
  description?: string;
  options?: Array<{ code: string; label: string }>;
};

type ReportingDataSourceCatalogItem = {
  code: string;
  title: string;
  category: string;
  scopeLevels: string[];
  fields: ReportingFieldCatalogItem[];
  metrics: ReportingFieldCatalogItem[];
  groupBy: ReportingFieldCatalogItem[];
  filters: ReportingFieldCatalogItem[];
  defaultVisualization: ReportingVisualizationType;
};

type ReportingVisualizationType = 'table' | 'bar' | 'line' | 'pie' | 'kpi';

type ReportBuilderCatalog = {
  scopeLevels: Array<{ code: string; label: string; description: string }>;
  populationOptions: Array<{
    scopeLevel: string;
    label: string;
    values: Array<{ code: string; label: string; description?: string }>;
  }>;
  visualizationTypes: Array<{ code: ReportingVisualizationType; label: string }>;
  dataSources: ReportingDataSourceCatalogItem[];
  templates: Array<{
    code: string;
    title: string;
    dataSource: string;
    description?: string;
    fields: string[];
    metrics: string[];
    groupBy: string[];
    scopeLevel: string;
    visualization: ReportingVisualizationType;
    recommended?: boolean;
    recommendationReason?: string;
    packCodes?: string[];
    defaultFilters?: Array<{ code: string; value: string }>;
  }>;
  analyticsPacks: ReportingAnalyticsPack[];
  smartCategories: SmartAnalyticsCategory[];
  businessRelationships: ReportingBusinessRelationship[];
};

type ReportingTemplateCatalogItem = ReportBuilderCatalog['templates'][number];

type ReportingAnalyticsPack = {
  code: string;
  title: string;
  category: string;
  description: string;
  reportCodes: string[];
  dataSources: string[];
  defaultScopeLevel: string;
  defaultPeriod: string;
  outputs: string[];
};

type ReportAnalyticsRunResult = {
  packCode: string;
  title: string;
  generatedAt: string;
  scopeLevel: string;
  period: string;
  reportOptions: Array<{ code: string; title: string; dataSource: string; recommended: boolean }>;
  highlights: Array<{ label: string; value: string | number; tone: 'success' | 'warning' | 'default' }>;
  charts: Array<{ title: string; data: Array<{ label: string; value: number; secondaryValue?: number }> }>;
  suggestedNextActions: string[];
};

type SmartAnalyticsInsight = {
  code: string;
  title: string;
  question: string;
  metricLabel: string;
  metricValue: string | number;
  trend: string;
  tone: 'success' | 'warning' | 'default';
  explanation: string;
  dataSources: string[];
  relatedReports: string[];
  chart: Array<{ label: string; value: number; secondaryValue?: number }>;
  affectedRecords: Array<{ label: string; value: string; severity: 'safe' | 'watch' | 'risk' }>;
  actions: string[];
};

type SmartAnalyticsCategory = {
  code: string;
  title: string;
  group: string;
  description: string;
  businessQuestions: string[];
  dataSources: string[];
  reportCodes: string[];
  drilldowns: string[];
  insights: SmartAnalyticsInsight[];
};

type ReportingBusinessRelationship = {
  code: string;
  title: string;
  from: string;
  to: string;
  relationship: string;
  businessUse: string;
  grain?: string;
  joinKeys?: string[];
  privacyLevel?: 'standard' | 'sensitive' | 'restricted';
  lineage?: string[];
  recommendedDrilldowns?: string[];
};

type SmartAnalyticsRunResult = {
  categoryCode: string;
  title: string;
  generatedAt: string;
  scopeLevel: string;
  period: string;
  summary: string;
  insights: SmartAnalyticsInsight[];
  drilldowns: string[];
  relatedReports: Array<{ code: string; title: string; dataSource: string }>;
  relationships: ReportingBusinessRelationship[];
};

type ReportDefinitionPreview = {
  valid: boolean;
  dataSource: string;
  scopeLevel: string;
  columns: string[];
  metrics: string[];
  groupBy: string[];
  rowCountEstimate: number;
  chartData: Array<{ label: string; value: number; secondaryValue?: number }>;
  sampleRows: Array<Record<string, string | number>>;
  warnings: string[];
};

type SavedReportDefinition = {
  id?: string;
  reportDefinitionId?: string;
  reportName?: string;
  name?: string;
  reportType?: string;
  dataSource?: string;
  status?: string;
  queryDefinition?: {
    fields?: string[];
    metrics?: string[];
    groupBy?: string[];
    scopeLevel?: string;
    populationValue?: string;
    visualization?: ReportingVisualizationType;
  };
};

type CalculatedFieldDefinition = {
  id?: string;
  calculatedFieldId?: string;
  fieldName?: string;
  expression?: string;
  dataType?: string;
  sourceFields?: string[];
  status?: string;
};

type ReportingTab = 'overview' | 'analytics' | 'builder' | 'relationships' | 'library' | 'activity';

function unwrapApiData<T>(payload: unknown): T {
  const response = payload as { success?: boolean; data?: T };
  return response?.success === true && response.data !== undefined ? response.data : payload as T;
}

function readinessTone(readiness: HrReportReadiness) {
  if (readiness === 'Attention') return 'border-[#f59e0b]/35 bg-[#fef3c7] text-[#92400e]';
  if (readiness === 'Live') return 'border-[#10b981]/25 bg-[#d1fae5] text-[#065f46]';
  return 'border-[#cbd5e1] bg-white text-[#475569]';
}

function formatMetricValue(metric: HrAnalyticsMetric) {
  const value = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(metric.value);
  if (metric.unit === 'currency') return `${metric.currency ?? 'USD'} ${value}`;
  if (metric.unit === 'hours') return `${value}h`;
  if (metric.unit === 'days') return `${value}d`;
  if (metric.unit === 'rating') return value;
  return value;
}

function fieldLabels(source: ReportingDataSourceCatalogItem | undefined, codes: string[] | undefined) {
  if (!source || !codes) return '';
  const catalog = [...source.fields, ...source.metrics, ...source.groupBy];
  return codes
    .map((code) => catalog.find((item) => item.code === code)?.label ?? code)
    .join(', ');
}

function defaultFieldCodes(source: ReportingDataSourceCatalogItem | undefined) {
  return source?.fields.filter((field) => field.defaultSelected).map((field) => field.code) ?? [];
}

function defaultMetricCodes(source: ReportingDataSourceCatalogItem | undefined) {
  return source?.metrics.slice(0, 2).map((metric) => metric.code) ?? [];
}

function defaultGroupByCodes(source: ReportingDataSourceCatalogItem | undefined) {
  return source?.groupBy.slice(0, 1).map((field) => field.code) ?? [];
}

function groupSourcesByCategory(sources: ReportingDataSourceCatalogItem[]) {
  return sources.reduce<Record<string, ReportingDataSourceCatalogItem[]>>((groups, source) => {
    groups[source.category] = [...(groups[source.category] ?? []), source];
    return groups;
  }, {});
}

function highlightTone(tone: 'success' | 'warning' | 'default') {
  if (tone === 'success') return 'border-[#10b981]/25 bg-[#d1fae5] text-[#065f46]';
  if (tone === 'warning') return 'border-[#f59e0b]/35 bg-[#fef3c7] text-[#92400e]';
  return 'border-[#cbd5e1] bg-[#f8fafc] text-[#475569]';
}

function recordSeverityTone(severity: 'safe' | 'watch' | 'risk') {
  if (severity === 'risk') return 'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]';
  if (severity === 'watch') return 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]';
  return 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]';
}

function groupSmartCategories(categories: SmartAnalyticsCategory[]) {
  return categories.reduce<Record<string, SmartAnalyticsCategory[]>>((groups, category) => {
    groups[category.group] = [...(groups[category.group] ?? []), category];
    return groups;
  }, {});
}

const chartColors = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899'];

const migrationTemplates = [
  { module: 'employees', title: 'Employees', owner: 'People Operations' },
  { module: 'attendance', title: 'Attendance', owner: 'Workforce Operations' },
  { module: 'leave', title: 'Leave', owner: 'Absence Administration' },
  { module: 'payroll', title: 'Payroll', owner: 'Payroll Administration' },
  { module: 'performance', title: 'Performance', owner: 'Talent Management' },
  { module: 'benefits', title: 'Benefits', owner: 'Reward Operations' },
  { module: 'headcount-org', title: 'Headcount & Org', owner: 'People Operations' },
  { module: 'compliance', title: 'Compliance', owner: 'Compliance Operations' },
  { module: 'services', title: 'HR Services', owner: 'HR Service Delivery' },
] as const;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AdminReporting() {
  const addNotification = useUIStore((state) => state.addNotification);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ReportingTab>('overview');
  const [reportName, setReportName] = useState('Monthly attendance exceptions');
  const [dataSourceCode, setDataSourceCode] = useState('ATTENDANCE');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [selectedGroupBy, setSelectedGroupBy] = useState<string[]>([]);
  const [scopeLevel, setScopeLevel] = useState('TENANT');
  const [populationValue, setPopulationValue] = useState('ALL');
  const [visualization, setVisualization] = useState<ReportingVisualizationType>('table');
  const [filterPeriod, setFilterPeriod] = useState('CURRENT_MONTH');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [selectedPackCode, setSelectedPackCode] = useState('FULL_HR_ANALYTICS');
  const [selectedSmartCategoryCode, setSelectedSmartCategoryCode] = useState('WORKFORCE_COMPOSITION');
  const [selectedReportCodes, setSelectedReportCodes] = useState<string[]>([]);
  const [calculatedFieldName, setCalculatedFieldName] = useState('Custom metric');
  const [calculatedFieldExpression, setCalculatedFieldExpression] = useState('grossPay - deductionAmount');
  const [calculatedFieldType, setCalculatedFieldType] = useState('currency');
  const [scheduleFrequency, setScheduleFrequency] = useState('MONTHLY');
  const [scheduleRecipients, setScheduleRecipients] = useState('hr.operations@example.com');
  const dashboardQuery = useQuery({
    queryKey: ['hr-reports-dashboard'],
    queryFn: async () => unwrapApiData<HrReportsDashboard>((await apiClient.get('/reporting/hr-dashboard')).data),
  });
  const analyticsQuery = useQuery({
    queryKey: ['hr-analytics-dashboard'],
    queryFn: async () => unwrapApiData<HrAnalyticsDashboard>((await apiClient.get('/reporting/hr-analytics')).data),
  });
  const builderCatalogQuery = useQuery({
    queryKey: ['report-builder-catalog'],
    queryFn: async () => unwrapApiData<ReportBuilderCatalog>((await apiClient.get('/reporting/builder/catalog')).data),
  });
  const savedReportsQuery = useQuery({
    queryKey: ['report-definitions', 'all'],
    queryFn: async () => unwrapApiData<SavedReportDefinition[]>((await apiClient.get('/reporting/report-definitions?status=ALL')).data),
  });
  const calculatedFieldsQuery = useQuery({
    queryKey: ['report-calculated-fields', 'all'],
    queryFn: async () => unwrapApiData<CalculatedFieldDefinition[]>((await apiClient.get('/reporting/calculated-fields?status=ALL')).data),
  });

  const catalog = builderCatalogQuery.data;
  const currentSource = useMemo(
    () => catalog?.dataSources.find((source) => source.code === dataSourceCode) ?? catalog?.dataSources[0],
    [catalog?.dataSources, dataSourceCode],
  );
  const currentPack = useMemo(
    () => catalog?.analyticsPacks.find((pack) => pack.code === selectedPackCode) ?? catalog?.analyticsPacks[0],
    [catalog?.analyticsPacks, selectedPackCode],
  );
  const currentSmartCategory = useMemo(
    () => catalog?.smartCategories.find((category) => category.code === selectedSmartCategoryCode) ?? catalog?.smartCategories[0],
    [catalog?.smartCategories, selectedSmartCategoryCode],
  );
  const sourceGroups = useMemo(() => groupSourcesByCategory(catalog?.dataSources ?? []), [catalog?.dataSources]);
  const smartCategoryGroups = useMemo(() => groupSmartCategories(catalog?.smartCategories ?? []), [catalog?.smartCategories]);
  const relationshipsForCurrentSource = useMemo(
    () => (catalog?.businessRelationships ?? []).filter((relationship) => relationship.from === dataSourceCode || relationship.to === dataSourceCode),
    [catalog?.businessRelationships, dataSourceCode],
  );
  const visibleRelationships = relationshipsForCurrentSource.length > 0 ? relationshipsForCurrentSource : (catalog?.businessRelationships ?? []);
  const smartCategoriesForCurrentSource = useMemo(
    () => (catalog?.smartCategories ?? []).filter((category) => category.dataSources.includes(dataSourceCode)),
    [catalog?.smartCategories, dataSourceCode],
  );
  const templatesForCurrentSource = useMemo(
    () => (catalog?.templates ?? []).filter((template) => template.dataSource === dataSourceCode),
    [catalog?.templates, dataSourceCode],
  );
  const fieldsForQuery = selectedFields.length > 0 ? selectedFields : defaultFieldCodes(currentSource);
  const metricsForQuery = selectedMetrics.length > 0 ? selectedMetrics : defaultMetricCodes(currentSource);
  const groupByForQuery = selectedGroupBy.length > 0 ? selectedGroupBy : defaultGroupByCodes(currentSource);
  const scopeForQuery = currentSource?.scopeLevels.includes(scopeLevel) ? scopeLevel : currentSource?.scopeLevels[0] ?? 'TENANT';
  const populationOptionsForScope = useMemo(
    () => catalog?.populationOptions.find((option) => option.scopeLevel === scopeForQuery),
    [catalog?.populationOptions, scopeForQuery],
  );
  const populationValueForQuery = populationOptionsForScope?.values.some((option) => option.code === populationValue)
    ? populationValue
    : populationOptionsForScope?.values[0]?.code;
  const populationLabelForQuery = populationOptionsForScope?.values.find((option) => option.code === populationValueForQuery)?.label ?? 'All workers';
  const visualizationForQuery = visualization;

  const buildQueryDefinition = () => ({
    version: 1,
    fields: fieldsForQuery,
    metrics: metricsForQuery,
    groupBy: groupByForQuery,
    scopeLevel: scopeForQuery,
    populationValue: populationValueForQuery,
    visualization: visualizationForQuery,
    filters: [
      { code: 'period', value: filterPeriod },
      ...Object.entries(filterValues)
        .filter(([, value]) => value.trim().length > 0)
        .map(([code, value]) => ({ code, value })),
    ],
    sourcePackCode: selectedPackCode,
  });

  const previewMutation = useMutation({
    mutationFn: async () => unwrapApiData<ReportDefinitionPreview>((await apiClient.post('/reporting/report-definitions/preview', {
      dataSource: currentSource?.code ?? dataSourceCode,
      queryDefinition: buildQueryDefinition(),
      parameters: { period: filterPeriod },
    })).data),
    onError: (error) => addNotification({
      title: 'Preview failed',
      message: error instanceof Error ? error.message : 'Could not preview the report.',
      type: 'error',
      read: false,
    }),
  });
  const saveReportMutation = useMutation({
    mutationFn: async () => unwrapApiData<SavedReportDefinition>((await apiClient.post('/reporting/report-definitions', {
      reportDefinitionId: generateUUID(),
      reportName: reportName.trim() || `${currentSource?.title ?? 'HR'} report`,
      reportType: 'CUSTOM',
      dataSource: currentSource?.code ?? dataSourceCode,
      queryDefinition: buildQueryDefinition(),
      parameters: { period: filterPeriod },
    })).data),
    onSuccess: async () => {
      addNotification({ title: 'Report saved', message: 'The report definition is now available in the report library.', type: 'success', read: false });
      await queryClient.invalidateQueries({ queryKey: ['report-definitions', 'all'] });
    },
    onError: (error) => addNotification({
      title: 'Could not save report',
      message: error instanceof Error ? error.message : 'The report definition was not saved.',
      type: 'error',
      read: false,
    }),
  });
  const runAnalyticsPackMutation = useMutation({
    mutationFn: async () => unwrapApiData<ReportAnalyticsRunResult>((await apiClient.post('/reporting/builder/analytics-packs/run', {
      packCode: currentPack?.code ?? selectedPackCode,
      scopeLevel: currentPack?.defaultScopeLevel ?? scopeForQuery,
      populationValue: populationValueForQuery,
      period: filterPeriod,
      selectedReportCodes: selectedReportCodes.length > 0 ? selectedReportCodes : currentPack?.reportCodes,
      filters: Object.entries(filterValues).filter(([, value]) => value.trim()).map(([code, value]) => ({ code, value })),
    })).data),
    onError: (error) => addNotification({
      title: 'Analytics run failed',
      message: error instanceof Error ? error.message : 'Could not run the analytics pack.',
      type: 'error',
      read: false,
    }),
  });
  const runSmartCategoryMutation = useMutation({
    mutationFn: async () => unwrapApiData<SmartAnalyticsRunResult>((await apiClient.post('/reporting/builder/smart-categories/run', {
      categoryCode: currentSmartCategory?.code ?? selectedSmartCategoryCode,
      scopeLevel: scopeForQuery,
      populationValue: populationValueForQuery,
      period: filterPeriod,
      selectedInsightCodes: currentSmartCategory?.insights.map((insight) => insight.code),
      filters: Object.entries(filterValues).filter(([, value]) => value.trim()).map(([code, value]) => ({ code, value })),
    })).data),
    onError: (error) => addNotification({
      title: 'Smart analytics failed',
      message: error instanceof Error ? error.message : 'Could not run this analytics category.',
      type: 'error',
      read: false,
    }),
  });
  const createCalculatedFieldMutation = useMutation({
    mutationFn: async () => unwrapApiData<CalculatedFieldDefinition>((await apiClient.post('/reporting/calculated-fields', {
      calculatedFieldId: generateUUID(),
      fieldName: calculatedFieldName.trim() || 'Custom metric',
      expression: calculatedFieldExpression.trim(),
      dataType: calculatedFieldType,
      sourceFields: [...fieldsForQuery, ...metricsForQuery],
    })).data),
    onSuccess: async () => {
      addNotification({ title: 'Calculated field saved', message: 'The custom metric is now available for report design.', type: 'success', read: false });
      await queryClient.invalidateQueries({ queryKey: ['report-calculated-fields', 'all'] });
    },
    onError: (error) => addNotification({
      title: 'Could not save calculated field',
      message: error instanceof Error ? error.message : 'The calculated field was not saved.',
      type: 'error',
      read: false,
    }),
  });
  const publishReportMutation = useMutation({
    mutationFn: async (reportId: string) => unwrapApiData<unknown>((await apiClient.post(`/reporting/report-definitions/${reportId}/commands/publish`, {})).data),
    onSuccess: async () => {
      addNotification({ title: 'Report published', message: 'The report can now be used by reporting users.', type: 'success', read: false });
      await queryClient.invalidateQueries({ queryKey: ['report-definitions', 'all'] });
    },
    onError: (error) => addNotification({ title: 'Could not publish report', message: error instanceof Error ? error.message : 'Publish failed.', type: 'error', read: false }),
  });
  const runReportMutation = useMutation({
    mutationFn: async (report: SavedReportDefinition) => unwrapApiData<unknown>((await apiClient.post('/reporting/report-executions', {
      reportExecutionId: generateUUID(),
      reportDefinitionId: report.reportDefinitionId ?? report.id,
      executedBy: generateUUID(),
      parameters: { period: filterPeriod, source: 'admin-reporting' },
    })).data),
    onSuccess: () => addNotification({ title: 'Report queued', message: 'The report run was added to the execution queue.', type: 'success', read: false }),
    onError: (error) => addNotification({ title: 'Could not run report', message: error instanceof Error ? error.message : 'Run failed.', type: 'error', read: false }),
  });
  const scheduleReportMutation = useMutation({
    mutationFn: async (report: SavedReportDefinition) => unwrapApiData<unknown>((await apiClient.post('/reporting/report-schedules', {
      reportScheduleId: generateUUID(),
      reportDefinitionId: report.reportDefinitionId ?? report.id,
      frequency: scheduleFrequency,
      recipients: scheduleRecipients.split(',').map((recipient) => recipient.trim()).filter(Boolean),
      nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })).data),
    onSuccess: () => addNotification({ title: 'Schedule created', message: 'The report schedule is now ready for automated delivery.', type: 'success', read: false }),
    onError: (error) => addNotification({ title: 'Could not schedule report', message: error instanceof Error ? error.message : 'Schedule failed.', type: 'error', read: false }),
  });

  const defaultPopulationValueForScope = (nextScope: string) =>
    catalog?.populationOptions.find((option) => option.scopeLevel === nextScope)?.values[0]?.code ?? 'ALL';

  const applyScopeLevel = (nextScope: string) => {
    setScopeLevel(nextScope);
    setPopulationValue(defaultPopulationValueForScope(nextScope));
  };

  const applyDataSource = (code: string) => {
    const nextSource = catalog?.dataSources.find((source) => source.code === code);
    const nextScope = nextSource?.scopeLevels[0] ?? 'TENANT';
    setDataSourceCode(code);
    setSelectedFields(defaultFieldCodes(nextSource));
    setSelectedMetrics(defaultMetricCodes(nextSource));
    setSelectedGroupBy(defaultGroupByCodes(nextSource));
    setScopeLevel(nextScope);
    setPopulationValue(defaultPopulationValueForScope(nextScope));
    setVisualization(nextSource?.defaultVisualization ?? 'table');
    setFilterValues({});
  };

  const applyTemplate = (template: ReportingTemplateCatalogItem) => {
    const nextSource = catalog?.dataSources.find((source) => source.code === template.dataSource);
    setReportName(template.title);
    setDataSourceCode(template.dataSource);
    setSelectedFields(template.fields);
    setSelectedMetrics(template.metrics);
    setSelectedGroupBy(template.groupBy);
    setScopeLevel(template.scopeLevel);
    setPopulationValue(defaultPopulationValueForScope(template.scopeLevel));
    setVisualization(template.visualization);
    setFilterValues({});
    setSelectedReportCodes([template.code]);
    if (nextSource) {
      setCalculatedFieldExpression(nextSource.metrics.slice(0, 2).map((metric) => metric.code).join(' + ') || calculatedFieldExpression);
    }
  };

  const applyPack = (pack: ReportingAnalyticsPack) => {
    setSelectedPackCode(pack.code);
    setSelectedReportCodes(pack.reportCodes);
    setFilterPeriod(pack.defaultPeriod);
    setScopeLevel(pack.defaultScopeLevel);
    setPopulationValue(defaultPopulationValueForScope(pack.defaultScopeLevel));
    const firstTemplate = catalog?.templates.find((template) => pack.reportCodes.includes(template.code));
    if (firstTemplate) {
      applyTemplate(firstTemplate);
      setSelectedPackCode(pack.code);
      setSelectedReportCodes(pack.reportCodes);
      setFilterPeriod(pack.defaultPeriod);
      setScopeLevel(pack.defaultScopeLevel);
      setPopulationValue(defaultPopulationValueForScope(pack.defaultScopeLevel));
    }
  };

  const applySmartCategory = (category: SmartAnalyticsCategory) => {
    setSelectedSmartCategoryCode(category.code);
    setSelectedReportCodes(category.reportCodes);
    const firstTemplate = catalog?.templates.find((template) => category.reportCodes.includes(template.code));
    if (firstTemplate) {
      applyTemplate(firstTemplate);
      setSelectedSmartCategoryCode(category.code);
      setSelectedReportCodes(category.reportCodes);
    } else if (category.dataSources[0]) {
      applyDataSource(category.dataSources[0]);
    }
  };

  const toggleCode = (code: string, values: string[], setter: (next: string[]) => void) => {
    setter(values.includes(code) ? values.filter((item) => item !== code) : [...values, code]);
  };

  const downloadCsv = async (path: string, filename: string) => {
    try {
      const response = await apiClient.get(path, { responseType: 'blob' });
      downloadBlob(response.data as Blob, filename);
    } catch (err) {
      addNotification({ title: 'Download failed', message: err instanceof Error ? err.message : 'Could not download reporting file.', type: 'error', read: false });
    }
  };

  const dashboard = dashboardQuery.data;
  const analytics = analyticsQuery.data;
  const topReports = [...(dashboard?.reports ?? [])].sort((a, b) => b.activity - a.activity).slice(0, 5);
  const attentionReports = (dashboard?.reports ?? []).filter((report) => report.readiness === 'Attention');

  return (
    <div className="space-y-6">
      <BusinessPageHeader
        eyebrow="Insights"
        title="HR Reporting"
        subtitle="Track workforce, reward, talent, service, and governance activity from one reporting workspace."
        icon={BarChart3}
        actions={(
          <>
            <Button
              variant="outline"
              onClick={() => {
                void dashboardQuery.refetch();
                void analyticsQuery.refetch();
                void builderCatalogQuery.refetch();
                void savedReportsQuery.refetch();
                void calculatedFieldsQuery.refetch();
              }}
              disabled={dashboardQuery.isFetching || analyticsQuery.isFetching || builderCatalogQuery.isFetching || savedReportsQuery.isFetching || calculatedFieldsQuery.isFetching}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </>
        )}
      />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ReportingTab)}>
        <TabsList className="h-auto flex-wrap justify-start bg-[#f8fafc] p-1">
          <TabsTrigger value="overview">Command Center</TabsTrigger>
          <TabsTrigger value="analytics">Smart Analytics</TabsTrigger>
          <TabsTrigger value="builder">Report Builder</TabsTrigger>
          <TabsTrigger value="relationships">Data Relationships</TabsTrigger>
          <TabsTrigger value="library">Library & Delivery</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
      </Tabs>

      {dashboardQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-24 rounded-2xl" />)}
        </div>
      ) : dashboardQuery.isError ? (
        <ErrorState title="Unable to load reporting" error={dashboardQuery.error} onRetry={() => dashboardQuery.refetch()} />
      ) : dashboard ? (
        <>
          {activeTab === 'overview' ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <BusinessMetric label="Report Groups" value={`${dashboard.totals.activeReportGroups}/${dashboard.totals.reportGroups}`} tone="success" />
              <BusinessMetric label="Activity" value={dashboard.totals.totalActivity} />
              <BusinessMetric label="Queue Backlog" value={dashboard.totals.queueBacklog} tone={dashboard.totals.queueBacklog > 0 ? 'warning' : 'success'} />
              <BusinessMetric label="Open Issues" value={dashboard.totals.issues} tone={dashboard.totals.issues > 0 ? 'warning' : 'success'} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_24rem]">
              <Card className="rounded-2xl border-[#e2e8f0]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-[#4f46e5]" />
                    Report Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboard.activityByReport} margin={{ top: 10, right: 16, left: 0, bottom: 36 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" angle={-25} textAnchor="end" interval={0} height={70} tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="activity" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="issues" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-[#e2e8f0]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-[#f59e0b]" />
                    Attention Queue
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {attentionReports.length > 0 ? attentionReports.map((report) => (
                    <div key={report.code} className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-[#0f172a]">{report.title}</p>
                        <Badge variant="outline" className={cn('border', readinessTone(report.readiness))}>{report.readiness}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-[#475569]">{report.issues} issue(s), {report.queueBacklog} queued item(s)</p>
                    </div>
                  )) : (
                    <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-4 text-sm text-[#166534]">
                      All report groups are clear.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
          ) : null}

          {activeTab === 'analytics' ? (
          <div className="space-y-6">
          {analyticsQuery.isLoading ? (
            <div className="grid gap-4 md:grid-cols-4">
              {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-24 rounded-2xl" />)}
            </div>
          ) : analyticsQuery.isError ? (
            <ErrorState title="Unable to load analytics" error={analyticsQuery.error} onRetry={() => analyticsQuery.refetch()} />
          ) : analytics ? (
            <>
              <SectionHeading title="Smart HR Analytics Studio" />
              {catalog && currentSmartCategory ? (
                <div className="grid gap-4 xl:grid-cols-[22rem_1fr]">
                  <Card className="rounded-2xl border-[#e2e8f0]">
                    <CardHeader>
                      <CardTitle>Business Categories</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {Object.entries(smartCategoryGroups).map(([group, categories]) => (
                        <div key={group} className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">{group}</p>
                          <div className="space-y-2">
                            {categories.map((category) => (
                              <button
                                key={category.code}
                                type="button"
                                onClick={() => applySmartCategory(category)}
                                className={cn(
                                  'w-full rounded-xl border p-3 text-left transition hover:border-[#4f46e5]/50 hover:bg-[#eef2ff]',
                                  currentSmartCategory.code === category.code ? 'border-[#4f46e5] bg-[#eef2ff]' : 'border-[#e2e8f0] bg-white',
                                )}
                              >
                                <p className="font-semibold text-[#0f172a]">{category.title}</p>
                                <p className="mt-1 text-xs text-[#64748b]">{category.insights.length} insights · {category.dataSources.length} data domains</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <div className="space-y-4">
                    <Card className="rounded-2xl border-[#e2e8f0]">
                      <CardHeader>
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <CardTitle>{currentSmartCategory.title}</CardTitle>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#475569]">{currentSmartCategory.description}</p>
                          </div>
                          <Button
                            onClick={() => runSmartCategoryMutation.mutate()}
                            disabled={runSmartCategoryMutation.isPending}
                            className="bg-[#4f46e5] text-white hover:bg-[#4338ca]"
                          >
                            <BarChart3 className="mr-2 h-4 w-4" />
                            Run Category Analysis
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-3 lg:grid-cols-3">
                          {currentSmartCategory.businessQuestions.map((question) => (
                            <div key={question} className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3 text-sm text-[#475569]">
                              {question}
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {currentSmartCategory.drilldowns.map((drilldown) => (
                            <Badge key={drilldown} variant="outline" className="border-[#cbd5e1] bg-white text-[#475569]">
                              {drilldown}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid gap-4 xl:grid-cols-2">
                      {currentSmartCategory.insights.map((insight) => (
                        <Card key={insight.code} className="rounded-2xl border-[#e2e8f0]">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <CardTitle className="text-lg">{insight.title}</CardTitle>
                                <p className="mt-1 text-sm text-[#64748b]">{insight.question}</p>
                              </div>
                              <Badge variant="outline" className={cn('border', highlightTone(insight.tone))}>{insight.metricLabel}</Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid gap-3 md:grid-cols-[12rem_1fr]">
                              <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
                                <p className="text-xs font-medium text-[#64748b]">{insight.metricLabel}</p>
                                <p className="mt-1 text-2xl font-bold text-[#0f172a]">{insight.metricValue}</p>
                                <p className="mt-1 text-xs text-[#64748b]">{insight.trend}</p>
                              </div>
                              <div className="rounded-xl border border-[#e2e8f0] bg-white p-3 text-sm leading-6 text-[#475569]">
                                {insight.explanation}
                              </div>
                            </div>
                            <div className="h-44">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={insight.chart} margin={{ top: 8, right: 8, left: 0, bottom: 28 }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                  <XAxis dataKey="label" angle={-20} textAnchor="end" interval={0} height={50} tick={{ fontSize: 10 }} />
                                  <YAxis allowDecimals={false} />
                                  <Tooltip />
                                  <Bar dataKey="value" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="grid gap-2 md:grid-cols-2">
                              {insight.affectedRecords.map((record) => (
                                <div key={`${insight.code}-${record.label}`} className={cn('rounded-xl border p-3 text-sm', recordSeverityTone(record.severity))}>
                                  <p className="font-semibold">{record.label}</p>
                                  <p className="mt-1">{record.value}</p>
                                </div>
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {insight.actions.map((action) => (
                                <Button key={action} size="sm" variant="outline">{action}</Button>
                              ))}
                              {insight.relatedReports.length > 0 ? (
                                <Button
                                  size="sm"
                                  className="bg-[#0f172a] text-white hover:bg-[#1e293b]"
                                  onClick={() => {
                                    const template = catalog.templates.find((item) => item.code === insight.relatedReports[0]);
                                    if (template) {
                                      applyTemplate(template);
                                      setActiveTab('builder');
                                    }
                                  }}
                                >
                                  Open in Builder
                                </Button>
                              ) : null}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {runSmartCategoryMutation.data ? (
                      <Card className="rounded-2xl border-[#e2e8f0]">
                        <CardHeader>
                          <CardTitle>Category Run Result</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <p className="text-sm leading-6 text-[#475569]">{runSmartCategoryMutation.data.summary}</p>
                          <div className="grid gap-3 lg:grid-cols-3">
                            {runSmartCategoryMutation.data.relatedReports.map((report) => (
                              <div key={report.code} className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
                                <p className="font-semibold text-[#0f172a]">{report.title}</p>
                                <p className="mt-1 text-xs text-[#64748b]">{report.dataSource}</p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <SectionHeading title="Operational Analytics Coverage" />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {analytics.headlineMetrics.map((metric) => (
                  <BusinessMetric
                    key={metric.label}
                    label={metric.label}
                    value={formatMetricValue(metric)}
                    tone={metric.label === 'Risk Signals' && metric.value > 0 ? 'warning' : 'default'}
                  />
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
                <Card className="rounded-2xl border-[#e2e8f0]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-[#4f46e5]" />
                      Analytics Mix
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={analytics.modules.map((module) => ({
                          label: module.code,
                          value: module.primary.value,
                          risk: module.risk.value,
                        }))}
                        margin={{ top: 10, right: 16, left: 0, bottom: 12 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="risk" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-[#e2e8f0]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldAlert className="h-5 w-5 text-[#f59e0b]" />
                      Analytics Signals
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {analytics.riskSignals.length > 0 ? analytics.riskSignals.map((signal) => (
                      <div key={signal.label} className="flex items-center justify-between rounded-xl border border-[#fde68a] bg-[#fffbeb] p-3">
                        <span className="text-sm font-medium text-[#0f172a]">{signal.label}</span>
                        <Badge variant="outline" className="border-[#f59e0b]/35 bg-[#fef3c7] text-[#92400e]">{signal.value}</Badge>
                      </div>
                    )) : (
                      <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-4 text-sm text-[#166534]">
                        No analytics signals for the selected period.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {analytics.modules.map((module) => (
                  <Card key={module.code} className="rounded-2xl border-[#e2e8f0]">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-lg">{module.title}</CardTitle>
                          <p className="mt-1 text-sm text-[#64748b]">{module.category}</p>
                        </div>
                        <Badge variant="outline" className={module.risk.value > 0 ? 'border-[#f59e0b]/35 bg-[#fef3c7] text-[#92400e]' : 'border-[#10b981]/25 bg-[#d1fae5] text-[#065f46]'}>
                          {module.risk.value > 0 ? `${module.risk.value} signal(s)` : 'Clear'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-[#64748b]">{module.primary.label}</p>
                          <p className="text-lg font-bold text-[#0f172a]">{formatMetricValue(module.primary)}</p>
                        </div>
                        <div>
                          <p className="text-[#64748b]">{module.secondary.label}</p>
                          <p className="text-lg font-bold text-[#0f172a]">{formatMetricValue(module.secondary)}</p>
                        </div>
                        <div>
                          <p className="text-[#64748b]">{module.risk.label}</p>
                          <p className={cn('text-lg font-bold', module.risk.value > 0 ? 'text-[#b45309]' : 'text-[#047857]')}>{formatMetricValue(module.risk)}</p>
                        </div>
                      </div>
                      <div className="h-40">
                        {module.chart.data.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={module.chart.data} margin={{ top: 8, right: 8, left: 0, bottom: 28 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="label" angle={-20} textAnchor="end" interval={0} height={50} tick={{ fontSize: 10 }} />
                              <YAxis allowDecimals={false} />
                              <Tooltip />
                              <Bar dataKey="value" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-[#cbd5e1] text-sm text-[#64748b]">
                            No analytics data yet.
                          </div>
                        )}
                      </div>
                      {module.lastActivityAt ? (
                        <p className="text-xs text-[#64748b]">Last activity: {new Date(module.lastActivityAt).toLocaleString()}</p>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : null}
          </div>
          ) : null}

          {activeTab === 'builder' ? (
          <div className="space-y-6">
            <SectionHeading title="Report Builder" />
            {builderCatalogQuery.isLoading ? (
              <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
                <Skeleton className="h-[480px] rounded-2xl" />
                <Skeleton className="h-[480px] rounded-2xl" />
              </div>
            ) : builderCatalogQuery.isError ? (
              <ErrorState title="Unable to load report builder" error={builderCatalogQuery.error} onRetry={() => builderCatalogQuery.refetch()} />
            ) : catalog && currentSource ? (
              <>
              <Card className="rounded-2xl border-[#e2e8f0]">
                <CardHeader>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <CardTitle>Choose What to Run</CardTitle>
                    <Button
                      onClick={() => runAnalyticsPackMutation.mutate()}
                      disabled={runAnalyticsPackMutation.isPending || !currentPack}
                      className="bg-[#4f46e5] text-white hover:bg-[#4338ca]"
                    >
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Run Smart Analytics
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    {catalog.analyticsPacks.map((pack) => (
                      <button
                        key={pack.code}
                        type="button"
                        onClick={() => applyPack(pack)}
                        className={cn(
                          'rounded-xl border bg-white p-4 text-left transition hover:border-[#4f46e5]/50 hover:bg-[#eef2ff]',
                          currentPack?.code === pack.code ? 'border-[#4f46e5] bg-[#eef2ff]' : 'border-[#e2e8f0]',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-[#0f172a]">{pack.title}</p>
                          <Badge variant="outline" className="border-[#cbd5e1] bg-white text-[#475569]">{pack.category}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-[#64748b]">{pack.description}</p>
                        <p className="mt-3 text-xs font-medium text-[#4f46e5]">{pack.outputs.slice(0, 2).join(' • ')}</p>
                      </button>
                    ))}
                  </div>

                  {runAnalyticsPackMutation.data ? (
                    <div className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="font-semibold text-[#0f172a]">{runAnalyticsPackMutation.data.title}</p>
                          <p className="mt-1 text-sm text-[#64748b]">Scope: {runAnalyticsPackMutation.data.scopeLevel} · Period: {runAnalyticsPackMutation.data.period}</p>
                        </div>
                        <Badge variant="outline" className="border-[#10b981]/25 bg-[#d1fae5] text-[#065f46]">Analytics ready</Badge>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {runAnalyticsPackMutation.data.highlights.map((item) => (
                          <div key={item.label} className={cn('rounded-xl border p-3', highlightTone(item.tone))}>
                            <p className="text-xs font-medium">{item.label}</p>
                            <p className="mt-1 text-xl font-bold">{item.value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        {runAnalyticsPackMutation.data.charts.slice(0, 2).map((chart) => (
                          <div key={chart.title} className="h-48 rounded-xl border border-[#e2e8f0] bg-white p-3">
                            <p className="mb-2 text-sm font-semibold text-[#0f172a]">{chart.title}</p>
                            <ResponsiveContainer width="100%" height="85%">
                              <BarChart data={chart.data} margin={{ top: 4, right: 8, left: 0, bottom: 24 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="label" angle={-15} textAnchor="end" interval={0} height={42} tick={{ fontSize: 10 }} />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 grid gap-2 lg:grid-cols-3">
                        {runAnalyticsPackMutation.data.suggestedNextActions.map((action) => (
                          <div key={action} className="rounded-xl border border-[#e2e8f0] bg-white p-3 text-sm text-[#475569]">{action}</div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-[#0f172a]">Recommended reports</p>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {catalog.templates
                        .filter((template) => !currentPack || currentPack.reportCodes.includes(template.code))
                        .map((template) => (
                          <button
                            key={template.code}
                            type="button"
                            onClick={() => applyTemplate(template)}
                            className={cn(
                              'rounded-xl border bg-white p-4 text-left transition hover:border-[#4f46e5]/50 hover:bg-[#eef2ff]',
                              selectedReportCodes.includes(template.code) ? 'border-[#4f46e5] bg-[#eef2ff]' : 'border-[#e2e8f0]',
                            )}
                          >
                            <p className="font-semibold text-[#0f172a]">{template.title}</p>
                            <p className="mt-1 text-sm text-[#64748b]">{catalog.dataSources.find((source) => source.code === template.dataSource)?.title ?? template.dataSource}</p>
                            <Badge variant="outline" className="mt-3 border-[#cbd5e1] bg-[#f8fafc] text-[#475569]">{template.visualization}</Badge>
                          </button>
                        ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-[#0f172a]">Underlying data catalog</p>
                    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
                      {Object.entries(sourceGroups).map(([category, sources]) => (
                        <div key={category} className="rounded-xl border border-[#e2e8f0] bg-white p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">{category}</p>
                          <div className="mt-2 space-y-2">
                            {sources.map((source) => (
                              <button
                                key={source.code}
                                type="button"
                                onClick={() => applyDataSource(source.code)}
                                className={cn(
                                  'w-full rounded-lg border px-3 py-2 text-left text-sm transition hover:border-[#4f46e5]/50',
                                  currentSource.code === source.code ? 'border-[#4f46e5] bg-[#eef2ff] text-[#3730a3]' : 'border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a]',
                                )}
                              >
                                <span className="font-medium">{source.title}</span>
                                <span className="mt-1 block text-xs text-[#64748b]">{source.metrics.length} metrics · {source.fields.length} fields</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
              <div className="grid gap-4 xl:grid-cols-[24rem_1fr]">
                <Card className="rounded-2xl border-[#e2e8f0]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-[#4f46e5]" />
                      Report Setup
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[#0f172a]" htmlFor="report-name">Report name</label>
                      <Input
                        id="report-name"
                        value={reportName}
                        onChange={(event) => setReportName(event.target.value)}
                        placeholder="Monthly attendance exceptions"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[#0f172a]">Underlying data</label>
                      <Select value={currentSource.code} onValueChange={applyDataSource}>
                        <SelectTrigger aria-label="Underlying data">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {catalog.dataSources.map((source) => (
                            <SelectItem key={source.code} value={source.code}>
                              {source.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[#0f172a]">Scope level</label>
                      <Select value={scopeForQuery} onValueChange={applyScopeLevel}>
                        <SelectTrigger aria-label="Scope level">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {catalog.scopeLevels
                            .filter((scope) => currentSource.scopeLevels.includes(scope.code))
                            .map((scope) => (
                              <SelectItem key={scope.code} value={scope.code}>
                                {scope.label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[#0f172a]">Report population</label>
                      <Select value={populationValueForQuery ?? 'ALL'} onValueChange={setPopulationValue}>
                        <SelectTrigger aria-label="Report population">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(populationOptionsForScope?.values ?? [{ code: 'ALL', label: 'All workers' }]).map((option) => (
                            <SelectItem key={option.code} value={option.code}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {populationOptionsForScope?.values.find((option) => option.code === populationValueForQuery)?.description ? (
                        <p className="text-xs text-[#64748b]">{populationOptionsForScope.values.find((option) => option.code === populationValueForQuery)?.description}</p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[#0f172a]">Period</label>
                      <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                        <SelectTrigger aria-label="Period">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CURRENT_MONTH">Current month</SelectItem>
                          <SelectItem value="LAST_90_DAYS">Last 90 days</SelectItem>
                          <SelectItem value="CURRENT_QUARTER">Current quarter</SelectItem>
                          <SelectItem value="YEAR_TO_DATE">Year to date</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[#0f172a]">Display</label>
                      <Select value={visualizationForQuery} onValueChange={(value) => setVisualization(value as ReportingVisualizationType)}>
                        <SelectTrigger aria-label="Display">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {catalog.visualizationTypes.map((item) => (
                            <SelectItem key={item.code} value={item.code}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {currentSource.filters.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-[#0f172a]">Report filters</p>
                        <div className="space-y-2">
                          {currentSource.filters.map((filter) => {
                            const value = filterValues[filter.code] ?? '';
                            if (filter.options && filter.options.length > 0) {
                              return (
                                <Select
                                  key={filter.code}
                                  value={value || 'ALL'}
                                  onValueChange={(next) => setFilterValues((current) => ({ ...current, [filter.code]: next === 'ALL' ? '' : next }))}
                                >
                                  <SelectTrigger aria-label={filter.label}>
                                    <SelectValue placeholder={filter.label} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="ALL">All {filter.label.toLowerCase()}</SelectItem>
                                    {filter.options.map((option) => (
                                      <SelectItem key={option.code} value={option.code}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              );
                            }
                            return (
                              <Input
                                key={filter.code}
                                type={filter.type === 'date' ? 'date' : 'text'}
                                aria-label={filter.label}
                                value={value}
                                placeholder={filter.label}
                                onChange={(event) => setFilterValues((current) => ({ ...current, [filter.code]: event.target.value }))}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3 text-sm text-[#64748b]">No additional filters for this report source.</div>
                    )}
                    <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3 text-sm text-[#475569]">
                      <p className="font-semibold text-[#0f172a]">{currentSource.category}</p>
                      <p className="mt-1">{currentSource.title} supports {currentSource.scopeLevels.length} scope level(s) and {currentSource.metrics.length} metric(s).</p>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Card className="rounded-2xl border-[#e2e8f0]">
                    <CardHeader>
                      <CardTitle>Columns, Metrics, and Grouping</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 lg:grid-cols-3">
                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-[#0f172a]">Columns</p>
                        <div className="space-y-2">
                          {currentSource.fields.map((field) => (
                            <label key={field.code} className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#0f172a]">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-[#4f46e5]"
                                checked={fieldsForQuery.includes(field.code)}
                                onChange={() => toggleCode(field.code, fieldsForQuery, setSelectedFields)}
                              />
                              {field.label}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-[#0f172a]">Metrics</p>
                        <div className="space-y-2">
                          {currentSource.metrics.map((metric) => (
                            <label key={metric.code} className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#0f172a]">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-[#10b981]"
                                checked={metricsForQuery.includes(metric.code)}
                                onChange={() => toggleCode(metric.code, metricsForQuery, setSelectedMetrics)}
                              />
                              {metric.label}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-[#0f172a]">Group by</p>
                        <div className="space-y-2">
                          {currentSource.groupBy.map((field) => (
                            <label key={field.code} className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#0f172a]">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-[#f59e0b]"
                                checked={groupByForQuery.includes(field.code)}
                                onChange={() => toggleCode(field.code, groupByForQuery, setSelectedGroupBy)}
                              />
                              {field.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
                    <Card className="rounded-2xl border-[#e2e8f0]">
                      <CardHeader>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <CardTitle className="flex items-center gap-2">
                            <Eye className="h-5 w-5 text-[#4f46e5]" />
                            Preview
                          </CardTitle>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              onClick={() => previewMutation.mutate()}
                              disabled={previewMutation.isPending || !currentSource}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              Preview
                            </Button>
                            <Button
                              onClick={() => saveReportMutation.mutate()}
                              disabled={saveReportMutation.isPending || !currentSource}
                              className="bg-[#4f46e5] text-white hover:bg-[#4338ca]"
                            >
                              <Save className="mr-2 h-4 w-4" />
                              Save Report
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {previewMutation.data ? (
                          <>
                            <div className="grid gap-3 sm:grid-cols-3">
                              <BusinessMetric label="Estimated rows" value={previewMutation.data.rowCountEstimate} />
                              <BusinessMetric label="Columns" value={previewMutation.data.columns.length} />
                              <BusinessMetric label="Metrics" value={previewMutation.data.metrics.length} />
                            </div>
                            {previewMutation.data.warnings.length > 0 ? (
                              <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-3 text-sm text-[#92400e]">
                                {previewMutation.data.warnings.join(' ')}
                              </div>
                            ) : null}
                            <div className="h-56 rounded-xl border border-[#e2e8f0] bg-white p-3">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={previewMutation.data.chartData} margin={{ top: 8, right: 8, left: 0, bottom: 28 }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                  <XAxis dataKey="label" angle={-20} textAnchor="end" interval={0} height={50} tick={{ fontSize: 10 }} />
                                  <YAxis allowDecimals={false} />
                                  <Tooltip />
                                  <Bar dataKey="value" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-[#e2e8f0]">
                              <table className="w-full text-left text-sm">
                                <thead className="bg-[#f8fafc] text-[#475569]">
                                  <tr>
                                    {Object.keys(previewMutation.data.sampleRows[0] ?? {}).map((column) => (
                                      <th key={column} className="px-3 py-2 font-semibold">{column}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#e2e8f0]">
                                  {previewMutation.data.sampleRows.map((row, index) => (
                                    <tr key={index}>
                                      {Object.entries(row).map(([column, value]) => (
                                        <td key={column} className="px-3 py-2 text-[#0f172a]">{value}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        ) : (
                          <div className="flex min-h-[18rem] items-center justify-center rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] text-center text-sm text-[#64748b]">
                            Choose the report data and click Preview to see sample rows and chart output.
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-[#e2e8f0]">
                      <CardHeader>
                        <CardTitle>Builder Summary</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <div>
                          <p className="text-[#64748b]">Data</p>
                          <p className="font-semibold text-[#0f172a]">{currentSource.title}</p>
                        </div>
                        <div>
                          <p className="text-[#64748b]">Columns</p>
                          <p className="text-[#0f172a]">{fieldLabels(currentSource, fieldsForQuery)}</p>
                        </div>
                        <div>
                          <p className="text-[#64748b]">Metrics</p>
                          <p className="text-[#0f172a]">{fieldLabels(currentSource, metricsForQuery)}</p>
                        </div>
                        <div>
                          <p className="text-[#64748b]">Group by</p>
                          <p className="text-[#0f172a]">{fieldLabels(currentSource, groupByForQuery)}</p>
                        </div>
                        <div>
                          <p className="text-[#64748b]">Scope</p>
                          <p className="font-semibold text-[#0f172a]">{catalog.scopeLevels.find((scope) => scope.code === scopeForQuery)?.label ?? scopeForQuery}</p>
                        </div>
                        <div>
                          <p className="text-[#64748b]">Population</p>
                          <p className="font-semibold text-[#0f172a]">{populationLabelForQuery}</p>
                        </div>
                        <div>
                          <p className="text-[#64748b]">Filters</p>
                          <p className="text-[#0f172a]">
                            {[`Period: ${filterPeriod}`, ...Object.entries(filterValues).filter(([, value]) => value.trim()).map(([code, value]) => `${code}: ${value}`)].join(', ')}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="rounded-2xl border-[#e2e8f0]">
                    <CardHeader>
                      <CardTitle>Calculated Fields</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-[#0f172a]" htmlFor="calculated-field-name">Metric name</label>
                        <Input id="calculated-field-name" value={calculatedFieldName} onChange={(event) => setCalculatedFieldName(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-[#0f172a]" htmlFor="calculated-field-expression">Formula</label>
                        <Input id="calculated-field-expression" value={calculatedFieldExpression} onChange={(event) => setCalculatedFieldExpression(event.target.value)} />
                      </div>
                      <div className="flex gap-2">
                        <Select value={calculatedFieldType} onValueChange={setCalculatedFieldType}>
                          <SelectTrigger aria-label="Metric type" className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="number">Number</SelectItem>
                            <SelectItem value="currency">Currency</SelectItem>
                            <SelectItem value="percentage">Percentage</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          onClick={() => createCalculatedFieldMutation.mutate()}
                          disabled={createCalculatedFieldMutation.isPending || calculatedFieldExpression.trim().length === 0}
                        >
                          Save Metric
                        </Button>
                      </div>
                      <div className="lg:col-span-3">
                        {(calculatedFieldsQuery.data ?? []).length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {(calculatedFieldsQuery.data ?? []).map((field, index) => (
                              <Badge key={field.calculatedFieldId ?? field.id ?? index} variant="outline" className="border-[#cbd5e1] bg-[#f8fafc] text-[#475569]">
                                {field.fieldName ?? 'Calculated field'} · {field.status ?? 'DRAFT'}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-[#64748b]">No calculated fields yet.</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
              </>
            ) : null}
          </div>
          ) : null}

          {activeTab === 'relationships' ? (
          <div className="space-y-6">
            <SectionHeading title="HR Data Relationship Map" />
            {builderCatalogQuery.isLoading ? (
              <div className="grid gap-4 xl:grid-cols-[22rem_1fr]">
                <Skeleton className="h-[520px] rounded-2xl" />
                <Skeleton className="h-[520px] rounded-2xl" />
              </div>
            ) : builderCatalogQuery.isError ? (
              <ErrorState title="Unable to load data relationships" error={builderCatalogQuery.error} onRetry={() => builderCatalogQuery.refetch()} />
            ) : catalog && currentSource ? (
              <div className="grid gap-4 xl:grid-cols-[22rem_1fr]">
                <Card className="rounded-2xl border-[#e2e8f0]">
                  <CardHeader>
                    <CardTitle>Business Data Domains</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Object.entries(sourceGroups).map(([category, sources]) => (
                      <div key={category} className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">{category}</p>
                        {sources.map((source) => (
                          <button
                            key={source.code}
                            type="button"
                            onClick={() => applyDataSource(source.code)}
                            className={cn(
                              'w-full rounded-xl border p-3 text-left transition hover:border-[#4f46e5]/50 hover:bg-[#eef2ff]',
                              currentSource.code === source.code ? 'border-[#4f46e5] bg-[#eef2ff]' : 'border-[#e2e8f0] bg-white',
                            )}
                          >
                            <p className="font-semibold text-[#0f172a]">{source.title}</p>
                            <p className="mt-1 text-xs text-[#64748b]">{source.metrics.length} measures · {source.fields.length} detail fields</p>
                          </button>
                        ))}
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Card className="rounded-2xl border-[#e2e8f0]">
                    <CardHeader>
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <CardTitle>{currentSource.title}</CardTitle>
                          <p className="mt-2 text-sm text-[#64748b]">{currentSource.category}</p>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setActiveTab('builder');
                            applyDataSource(currentSource.code);
                          }}
                        >
                          Build report from this data
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-4 lg:grid-cols-3">
                      <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
                        <p className="text-sm font-semibold text-[#0f172a]">Available fields</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {currentSource.fields.map((field) => (
                            <Badge key={field.code} variant="outline" className="border-[#cbd5e1] bg-white text-[#475569]">{field.label}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
                        <p className="text-sm font-semibold text-[#0f172a]">Available measures</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {currentSource.metrics.map((metric) => (
                            <Badge key={metric.code} variant="outline" className="border-[#bbf7d0] bg-white text-[#166534]">{metric.label}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
                        <p className="text-sm font-semibold text-[#0f172a]">Break down by</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {currentSource.groupBy.map((field) => (
                            <Badge key={field.code} variant="outline" className="border-[#fde68a] bg-white text-[#92400e]">{field.label}</Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <Card className="rounded-2xl border-[#e2e8f0]">
                      <CardHeader>
                        <CardTitle>How This Data Connects</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {visibleRelationships.length > 0 ? visibleRelationships.map((relationship) => {
                          const fromSource = catalog.dataSources.find((source) => source.code === relationship.from);
                          const toSource = catalog.dataSources.find((source) => source.code === relationship.to);
                          return (
                            <div key={relationship.code} className="rounded-xl border border-[#e2e8f0] bg-white p-4">
                              <p className="font-semibold text-[#0f172a]">{relationship.title}</p>
                              <p className="mt-2 text-sm leading-6 text-[#475569]">{relationship.businessUse}</p>
                              <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Feeds from</p>
                                  <p className="font-medium text-[#0f172a]">{fromSource?.title ?? relationship.from}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Used by</p>
                                  <p className="font-medium text-[#0f172a]">{toSource?.title ?? relationship.to}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Produces</p>
                                  <p className="font-medium text-[#0f172a]">{relationship.relationship}</p>
                                </div>
                              </div>
                              <div className="mt-4 grid gap-3 text-sm lg:grid-cols-2">
                                <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Data grain</p>
                                  <p className="mt-1 text-[#0f172a]">{relationship.grain ?? 'Business process record'}</p>
                                </div>
                                <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Privacy</p>
                                  <p className="mt-1 text-[#0f172a]">{relationship.privacyLevel ?? 'standard'}</p>
                                </div>
                              </div>
                              {relationship.joinKeys && relationship.joinKeys.length > 0 ? (
                                <div className="mt-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Join keys</p>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {relationship.joinKeys.map((key) => (
                                      <Badge key={key} variant="outline" className="border-[#cbd5e1] bg-[#f8fafc] text-[#475569]">{key}</Badge>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                              {relationship.lineage && relationship.lineage.length > 0 ? (
                                <div className="mt-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Lineage</p>
                                  <p className="mt-1 text-sm text-[#475569]">{relationship.lineage.join(' -> ')}</p>
                                </div>
                              ) : null}
                              {relationship.recommendedDrilldowns && relationship.recommendedDrilldowns.length > 0 ? (
                                <div className="mt-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Recommended drilldowns</p>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {relationship.recommendedDrilldowns.map((drilldown) => (
                                      <Badge key={drilldown} variant="outline" className="border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]">{drilldown}</Badge>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        }) : (
                          <div className="rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-6 text-sm text-[#64748b]">
                            No direct cross-module relationship is configured for this data domain yet.
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-[#e2e8f0]">
                      <CardHeader>
                        <CardTitle>Reports and Smart Analytics</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="text-sm font-semibold text-[#0f172a]">Recommended report templates</p>
                          <div className="mt-3 space-y-2">
                            {templatesForCurrentSource.length > 0 ? templatesForCurrentSource.map((template) => (
                              <button
                                key={template.code}
                                type="button"
                                onClick={() => {
                                  applyTemplate(template);
                                  setActiveTab('builder');
                                }}
                                className="w-full rounded-xl border border-[#e2e8f0] bg-white p-3 text-left transition hover:border-[#4f46e5]/50 hover:bg-[#eef2ff]"
                              >
                                <p className="font-semibold text-[#0f172a]">{template.title}</p>
                                <p className="mt-1 text-xs text-[#64748b]">{template.metrics.length} measures · {template.groupBy.length} breakdowns · {template.visualization}</p>
                              </button>
                            )) : (
                              <p className="rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-4 text-sm text-[#64748b]">No templates yet for this data domain.</p>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#0f172a]">Smart categories using this data</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {smartCategoriesForCurrentSource.length > 0 ? smartCategoriesForCurrentSource.map((category) => (
                              <button
                                key={category.code}
                                type="button"
                                onClick={() => {
                                  applySmartCategory(category);
                                  setActiveTab('analytics');
                                }}
                                className="rounded-full border border-[#cbd5e1] bg-white px-3 py-1.5 text-sm font-medium text-[#475569] transition hover:border-[#4f46e5]/50 hover:bg-[#eef2ff] hover:text-[#3730a3]"
                              >
                                {category.title}
                              </button>
                            )) : (
                              <span className="rounded-full border border-[#cbd5e1] bg-[#f8fafc] px-3 py-1.5 text-sm text-[#64748b]">No smart category yet</span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          ) : null}

          {activeTab === 'library' ? (
          <div className="space-y-6">
            <SectionHeading title="Library & Delivery" />
            <Card className="rounded-2xl border-[#e2e8f0]">
              <CardHeader>
                <CardTitle>Delivery Settings</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-[14rem_1fr]">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#0f172a]">Frequency</label>
                  <Select value={scheduleFrequency} onValueChange={setScheduleFrequency}>
                    <SelectTrigger aria-label="Schedule frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAILY">Daily</SelectItem>
                      <SelectItem value="WEEKLY">Weekly</SelectItem>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#0f172a]" htmlFor="schedule-recipients">Recipients</label>
                  <Input
                    id="schedule-recipients"
                    value={scheduleRecipients}
                    onChange={(event) => setScheduleRecipients(event.target.value)}
                    placeholder="hr.operations@example.com, finance@example.com"
                  />
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-[#e2e8f0]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[#4f46e5]" />
                  Saved Reports
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {savedReportsQuery.isLoading ? (
                  <Skeleton className="h-24 rounded-xl" />
                ) : savedReportsQuery.isError ? (
                  <ErrorState title="Unable to load saved reports" error={savedReportsQuery.error} onRetry={() => savedReportsQuery.refetch()} />
                ) : (savedReportsQuery.data ?? []).length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {(savedReportsQuery.data ?? []).map((report, index) => {
                      const source = catalog?.dataSources.find((item) => item.code === report.dataSource);
                      const reportId = report.reportDefinitionId ?? report.id;
                      return (
                        <div key={report.reportDefinitionId ?? report.id ?? index} className="rounded-xl border border-[#e2e8f0] bg-white p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-[#0f172a]">{report.reportName ?? report.name ?? 'Saved report'}</p>
                              <p className="mt-1 text-sm text-[#64748b]">{source?.title ?? report.dataSource ?? 'HR data'}</p>
                            </div>
                            <Badge variant="outline" className="border-[#cbd5e1] bg-[#f8fafc] text-[#475569]">{report.status ?? 'DRAFT'}</Badge>
                          </div>
                          <div className="mt-3 space-y-1 text-xs text-[#64748b]">
                            <p>Scope: {report.queryDefinition?.scopeLevel ?? 'TENANT'}</p>
                            <p>Population: {report.queryDefinition?.populationValue ?? 'ALL'}</p>
                            <p>Fields: {fieldLabels(source, report.queryDefinition?.fields) || 'Default fields'}</p>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!reportId || publishReportMutation.isPending}
                              onClick={() => reportId && publishReportMutation.mutate(reportId)}
                            >
                              Publish
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!reportId || runReportMutation.isPending}
                              onClick={() => reportId && runReportMutation.mutate(report)}
                            >
                              Run
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!reportId || scheduleReportMutation.isPending}
                              onClick={() => reportId && scheduleReportMutation.mutate(report)}
                            >
                              Schedule
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-6 text-sm text-[#64748b]">
                    No saved reports yet. Use Builder to create one from any HR data source.
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-[#e2e8f0]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-[#10b981]" />
                  Migration Templates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {migrationTemplates.map((template) => (
                    <div key={template.module} className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#0f172a]">{template.title}</p>
                          <p className="mt-1 text-sm text-[#64748b]">{template.owner}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadCsv(`/reporting/module-import-template.csv?module=${template.module}`, `${template.module}-import-template.csv`)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Template
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          ) : null}

          {activeTab === 'activity' ? (
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
              {dashboard.reports.map((report) => (
              <Card key={report.code} className="rounded-2xl border-[#e2e8f0]">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{report.title}</CardTitle>
                      <p className="mt-1 text-sm text-[#64748b]">{report.category}</p>
                    </div>
                    <Badge variant="outline" className={cn('border', readinessTone(report.readiness))}>{report.readiness}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-[11rem_1fr]">
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={report.chartData.filter((item) => item.value > 0)} dataKey="value" nameKey="label" innerRadius={34} outerRadius={56}>
                          {report.chartData.map((_entry, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[#64748b]">Activity</p>
                      <p className="text-xl font-bold text-[#0f172a]">{report.activity}</p>
                    </div>
                    <div>
                      <p className="text-[#64748b]">Issues</p>
                      <p className="text-xl font-bold text-[#0f172a]">{report.issues}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <BellRing className="h-4 w-4 text-[#4f46e5]" />
                      <span>{report.notifications} notifications</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-[#10b981]" />
                      <span>{report.workflowTransitions} workflows</span>
                    </div>
                    <div className="col-span-2 text-[#64748b]">
                      Last activity: {report.lastActivityAt ? new Date(report.lastActivityAt).toLocaleString() : 'No activity yet'}
                    </div>
                    {report.services && report.services.length > 0 ? (
                      <p className="col-span-2 text-xs font-medium text-[#475569]">Connected services: {report.services.slice(0, 3).join(', ')}</p>
                    ) : null}
                    {report.analyticsOutputs && report.analyticsOutputs.length > 0 ? (
                      <div className="col-span-2 flex flex-wrap gap-2">
                        {report.analyticsOutputs.slice(0, 4).map((output) => (
                          <Badge key={output} variant="outline" className="border-[#cbd5e1] bg-white text-[#475569]">
                            {output}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
              ))}
            </div>

            <Card className="rounded-2xl border-[#e2e8f0]">
              <CardHeader>
                <CardTitle>Top Report Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {topReports.map((report) => (
                  <div key={report.code} className="grid gap-2 rounded-xl bg-[#f8fafc] p-3 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <p className="font-semibold text-[#0f172a]">{report.title}</p>
                      <p className="text-sm text-[#64748b]">{report.commands} commands, {report.events} events, {report.notifications} notifications</p>
                    </div>
                    <Badge variant="outline" className={cn('border', readinessTone(report.readiness))}>{report.activity} activity</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
