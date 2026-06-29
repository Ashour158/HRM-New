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
import { BusinessMetric, SectionHeading } from '@/components/common/business-page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/common/error-state';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { generateUUID } from '@/lib/utils';
import { useUIStore } from '@/stores/ui-store';
import { ReportingOverviewTab } from './reporting/reporting-overview-tab';
import { ReportingPageHeader, ReportingTabs } from './reporting/reporting-shell';
import { readinessTone, type HrReportsDashboard, type ReportingTab } from './reporting/reporting-model';

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

type ReportingFilterOption = { code: string; label: string; count?: number };

type ReportingDataSourceCatalogItem = {
  code: string;
  title: string;
  category: string;
  description?: string;
  scopeLevels: string[];
  fields: ReportingFieldCatalogItem[];
  metrics: ReportingFieldCatalogItem[];
  groupBy: ReportingFieldCatalogItem[];
  filters: ReportingFieldCatalogItem[];
  defaultVisualization: ReportingVisualizationType;
};

type ReportingVisualizationType = 'table' | 'bar' | 'line' | 'pie' | 'kpi' | 'matrix' | 'comparison';

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

type SemanticReportQueryResult = {
  dataSource: string;
  sourceTitle: string;
  generatedAt: string;
  scopeLevel: string;
  populationValue?: string;
  columns: string[];
  metrics: string[];
  groupBy: string[];
  rowCount: number;
  drillThroughCount: number;
  rows: Array<Record<string, string | number>>;
  drillThroughRows: Array<Record<string, string | number>>;
  chartData: Array<{ label: string; value: number; secondaryValue?: number }>;
  insightCards: Array<{ label: string; value: string | number; tone: 'success' | 'warning' | 'default' }>;
  executionPlan: {
    grain: string;
    privacyLevel: 'standard' | 'sensitive' | 'restricted';
    appliedFilters: Array<{ code: string; value: string }>;
    availableDrilldowns: string[];
  };
  decisionSupport: {
    summary: string;
    topSegments: Array<{
      label: string;
      metric: string;
      value: number;
      shareOfTotal: number;
      severity: 'safe' | 'watch' | 'risk';
    }>;
    recommendedDrilldowns: Array<{
      field: string;
      label: string;
      reason: string;
    }>;
    nextActions: Array<{
      label: string;
      actionType: 'DRILLDOWN' | 'EXPORT' | 'SAVE' | 'SCHEDULE';
      reason: string;
    }>;
  };
  pivotBreakdowns: Array<{
    field: string;
    label: string;
    metric: string;
    totalSegments: number;
    segments: Array<{
      label: string;
      value: number;
      shareOfTotal: number;
      severity: 'safe' | 'watch' | 'risk';
    }>;
  }>;
  warnings: string[];
};

type SemanticFilterOptionsResult = {
  dataSource: string;
  sourceTitle: string;
  generatedAt: string;
  rowSource: 'live' | 'fixture';
  optionsByFilter: Array<{
    code: string;
    label: string;
    source: 'catalog' | 'live' | 'mixed';
    options: ReportingFilterOption[];
  }>;
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

type SavedReportExecution = {
  id?: string;
  reportExecutionId?: string;
  reportDefinitionId?: string | { value?: string };
  status?: string;
  rowCount?: number;
  resultUrl?: string;
  resultPayload?: SemanticReportQueryResult;
  createdAt?: string;
  queuedAt?: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt?: string;
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

function unwrapApiData<T>(payload: unknown): T {
  const response = payload as { success?: boolean; data?: T };
  return response?.success === true && response.data !== undefined ? response.data : payload as T;
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
  if (tone === 'success') return 'border-success/25 bg-success/15 text-success';
  if (tone === 'warning') return 'border-warning/35 bg-warning/15 text-warning';
  return 'border-border bg-muted text-muted-foreground';
}

function nextRunAtForFrequency(frequency: string, from = new Date()): string {
  const next = new Date(from.getTime());
  if (frequency === 'WEEKLY') {
    next.setDate(next.getDate() + 7);
  } else if (frequency === 'MONTHLY') {
    next.setMonth(next.getMonth() + 1);
  } else if (frequency === 'QUARTERLY') {
    next.setMonth(next.getMonth() + 3);
  } else {
    next.setDate(next.getDate() + 1);
  }
  return next.toISOString();
}

function recordSeverityTone(severity: 'safe' | 'watch' | 'risk') {
  if (severity === 'risk') return 'border-destructive/30 bg-destructive/10 text-destructive';
  if (severity === 'watch') return 'border-warning/30 bg-warning/10 text-warning';
  return 'border-success/30 bg-success/10 text-success';
}

function groupSmartCategories(categories: SmartAnalyticsCategory[]) {
  return categories.reduce<Record<string, SmartAnalyticsCategory[]>>((groups, category) => {
    groups[category.group] = [...(groups[category.group] ?? []), category];
    return groups;
  }, {});
}

function entityId(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'value' in value) {
    const nested = (value as { value?: unknown }).value;
    return typeof nested === 'string' ? nested : undefined;
  }
  return undefined;
}

function reportDefinitionId(report: SavedReportDefinition): string | undefined {
  return report.reportDefinitionId ?? report.id;
}

function reportExecutionDefinitionId(execution: SavedReportExecution): string | undefined {
  return entityId(execution.reportDefinitionId);
}

function formatExecutionTime(execution: SavedReportExecution): string {
  const value = execution.completedAt ?? execution.startedAt ?? execution.queuedAt ?? execution.createdAt ?? execution.updatedAt;
  if (!value) return 'Not timestamped';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
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
  const [expandedReportId, setExpandedReportId] = useState<string | undefined>();
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
  const reportExecutionsQuery = useQuery({
    queryKey: ['report-executions', 'recent'],
    queryFn: async () => unwrapApiData<SavedReportExecution[]>((await apiClient.get('/reporting/report-executions')).data),
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
  const availableFilters = useMemo(
    () => (currentSource?.filters ?? []).filter((filter) => filter.code !== 'period'),
    [currentSource?.filters],
  );
  const availableFilterCodes = useMemo(() => availableFilters.map((filter) => filter.code), [availableFilters]);
  const filterOptionsQuery = useQuery({
    queryKey: ['report-filter-options', currentSource?.code, availableFilterCodes.join('|')],
    queryFn: async () => unwrapApiData<SemanticFilterOptionsResult>((await apiClient.post('/reporting/builder/filter-options', {
      dataSource: currentSource?.code ?? dataSourceCode,
      filterCodes: availableFilterCodes,
      limit: 50,
    })).data),
    enabled: Boolean(currentSource && availableFilterCodes.length > 0),
  });
  const filterOptionsFor = (filter: ReportingFieldCatalogItem): ReportingFilterOption[] =>
    filterOptionsQuery.data?.optionsByFilter.find((optionSet) => optionSet.code === filter.code)?.options
      ?? filter.options
      ?? [];
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
  const semanticQueryMutation = useMutation({
    mutationFn: async () => unwrapApiData<SemanticReportQueryResult>((await apiClient.post('/reporting/builder/query/run', {
      dataSource: currentSource?.code ?? dataSourceCode,
      queryDefinition: buildQueryDefinition(),
      parameters: { period: filterPeriod },
      limit: 25,
    })).data),
    onError: (error) => addNotification({
      title: 'Report run failed',
      message: error instanceof Error ? error.message : 'Could not run the semantic report.',
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
    mutationFn: async (report: SavedReportDefinition) => {
      const id = reportDefinitionId(report);
      if (!id) {
        throw new Error('Cannot run report without a report definition ID.');
      }
      return unwrapApiData<SavedReportExecution>((await apiClient.post(`/reporting/report-definitions/${id}/commands/run`, {
        reportExecutionId: generateUUID(),
        parameters: { period: filterPeriod, source: 'admin-reporting' },
        limit: 50,
      })).data);
    },
    onSuccess: async (_result, report) => {
      setExpandedReportId(reportDefinitionId(report));
      addNotification({ title: 'Report completed', message: 'The report result is available in the execution history.', type: 'success', read: false });
      await queryClient.invalidateQueries({ queryKey: ['report-executions', 'recent'] });
    },
    onError: (error) => addNotification({ title: 'Could not run report', message: error instanceof Error ? error.message : 'Run failed.', type: 'error', read: false }),
  });
  const scheduleReportMutation = useMutation({
    mutationFn: async (report: SavedReportDefinition) => unwrapApiData<unknown>((await apiClient.post('/reporting/report-schedules', {
      reportScheduleId: generateUUID(),
      reportDefinitionId: report.reportDefinitionId ?? report.id,
      frequency: scheduleFrequency,
      recipients: scheduleRecipients.split(',').map((recipient) => recipient.trim()).filter(Boolean),
      nextRunAt: nextRunAtForFrequency(scheduleFrequency),
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
      <ReportingPageHeader
        isRefreshing={dashboardQuery.isFetching || analyticsQuery.isFetching || builderCatalogQuery.isFetching || savedReportsQuery.isFetching || reportExecutionsQuery.isFetching || calculatedFieldsQuery.isFetching || filterOptionsQuery.isFetching}
        onRefresh={() => {
          void dashboardQuery.refetch();
          void analyticsQuery.refetch();
          void builderCatalogQuery.refetch();
          void savedReportsQuery.refetch();
          void reportExecutionsQuery.refetch();
          void calculatedFieldsQuery.refetch();
          void filterOptionsQuery.refetch();
        }}
      />

      <ReportingTabs activeTab={activeTab} onTabChange={setActiveTab} />

      <div id="reporting-tabpanel" role="tabpanel" aria-labelledby={`reporting-tab-${activeTab}`} tabIndex={0}>
      {dashboardQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-24 rounded-2xl" />)}
        </div>
      ) : dashboardQuery.isError ? (
        <ErrorState title="Unable to load reporting" error={dashboardQuery.error} onRetry={() => dashboardQuery.refetch()} />
      ) : dashboard ? (
        <>
          {activeTab === 'overview' ? (
            <ReportingOverviewTab dashboard={dashboard} attentionReports={attentionReports} />
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
                  <Card className="rounded-2xl border-border">
                    <CardHeader>
                      <CardTitle>Business Categories</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {Object.entries(smartCategoryGroups).map(([group, categories]) => (
                        <div key={group} className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</p>
                          <div className="space-y-2">
                            {categories.map((category) => (
                              <button
                                key={category.code}
                                type="button"
                                onClick={() => applySmartCategory(category)}
                                className={cn(
                                  'w-full rounded-xl border p-3 text-start transition hover:border-primary/50 hover:bg-primary/10',
                                  currentSmartCategory.code === category.code ? 'border-primary bg-primary/10' : 'border-border bg-card',
                                )}
                              >
                                <p className="font-semibold text-foreground">{category.title}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{category.insights.length} insights · {category.dataSources.length} data domains</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <div className="space-y-4">
                    <Card className="rounded-2xl border-border">
                      <CardHeader>
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <CardTitle>{currentSmartCategory.title}</CardTitle>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{currentSmartCategory.description}</p>
                          </div>
                          <Button
                            onClick={() => runSmartCategoryMutation.mutate()}
                            disabled={runSmartCategoryMutation.isPending}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                          >
                            <BarChart3 className="me-2 h-4 w-4" />
                            Run Category Analysis
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-3 lg:grid-cols-3">
                          {currentSmartCategory.businessQuestions.map((question) => (
                            <div key={question} className="rounded-xl border border-border bg-muted p-3 text-sm text-muted-foreground">
                              {question}
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {currentSmartCategory.drilldowns.map((drilldown) => (
                            <Badge key={drilldown} variant="outline" className="border-border bg-card text-muted-foreground">
                              {drilldown}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid gap-4 xl:grid-cols-2">
                      {currentSmartCategory.insights.map((insight) => (
                        <Card key={insight.code} className="rounded-2xl border-border">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <CardTitle className="text-lg">{insight.title}</CardTitle>
                                <p className="mt-1 text-sm text-muted-foreground">{insight.question}</p>
                              </div>
                              <Badge variant="outline" className={cn('border', highlightTone(insight.tone))}>{insight.metricLabel}</Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid gap-3 md:grid-cols-[12rem_1fr]">
                              <div className="rounded-xl border border-border bg-muted p-3">
                                <p className="text-xs font-medium text-muted-foreground">{insight.metricLabel}</p>
                                <p className="mt-1 text-2xl font-bold text-foreground">{insight.metricValue}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{insight.trend}</p>
                              </div>
                              <div className="rounded-xl border border-border bg-card p-3 text-sm leading-6 text-muted-foreground">
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
                                  className="bg-foreground text-background hover:bg-foreground/90"
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
                      <Card className="rounded-2xl border-border">
                        <CardHeader>
                          <CardTitle>Category Run Result</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <p className="text-sm leading-6 text-muted-foreground">{runSmartCategoryMutation.data.summary}</p>
                          <div className="grid gap-3 lg:grid-cols-3">
                            {runSmartCategoryMutation.data.relatedReports.map((report) => (
                              <div key={report.code} className="rounded-xl border border-border bg-muted p-3">
                                <p className="font-semibold text-foreground">{report.title}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{report.dataSource}</p>
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
                <Card className="rounded-2xl border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
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

                <Card className="rounded-2xl border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldAlert className="h-5 w-5 text-warning" />
                      Analytics Signals
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {analytics.riskSignals.length > 0 ? analytics.riskSignals.map((signal) => (
                      <div key={signal.label} className="flex items-center justify-between rounded-xl border border-warning/30 bg-warning/10 p-3">
                        <span className="text-sm font-medium text-foreground">{signal.label}</span>
                        <Badge variant="outline" className="border-warning/35 bg-warning/15 text-warning">{signal.value}</Badge>
                      </div>
                    )) : (
                      <div className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm text-success">
                        No analytics signals for the selected period.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {analytics.modules.map((module) => (
                  <Card key={module.code} className="rounded-2xl border-border">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-lg">{module.title}</CardTitle>
                          <p className="mt-1 text-sm text-muted-foreground">{module.category}</p>
                        </div>
                        <Badge variant="outline" className={module.risk.value > 0 ? 'border-warning/35 bg-warning/15 text-warning' : 'border-success/25 bg-success/15 text-success'}>
                          {module.risk.value > 0 ? `${module.risk.value} signal(s)` : 'Clear'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">{module.primary.label}</p>
                          <p className="text-lg font-bold text-foreground">{formatMetricValue(module.primary)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">{module.secondary.label}</p>
                          <p className="text-lg font-bold text-foreground">{formatMetricValue(module.secondary)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">{module.risk.label}</p>
                          <p className={cn('text-lg font-bold', module.risk.value > 0 ? 'text-warning' : 'text-success')}>{formatMetricValue(module.risk)}</p>
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
                          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                            No analytics data yet.
                          </div>
                        )}
                      </div>
                      {module.lastActivityAt ? (
                        <p className="text-xs text-muted-foreground">Last activity: {new Date(module.lastActivityAt).toLocaleString()}</p>
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
              <Card className="rounded-2xl border-border">
                <CardHeader>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <CardTitle>Choose What to Run</CardTitle>
                    <Button
                      onClick={() => runAnalyticsPackMutation.mutate()}
                      disabled={runAnalyticsPackMutation.isPending || !currentPack}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <BarChart3 className="me-2 h-4 w-4" />
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
                          'rounded-xl border bg-card p-4 text-start transition hover:border-primary/50 hover:bg-primary/10',
                          currentPack?.code === pack.code ? 'border-primary bg-primary/10' : 'border-border',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-foreground">{pack.title}</p>
                          <Badge variant="outline" className="border-border bg-card text-muted-foreground">{pack.category}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{pack.description}</p>
                        <p className="mt-3 text-xs font-medium text-primary">{pack.outputs.slice(0, 2).join(' • ')}</p>
                      </button>
                    ))}
                  </div>

                  {runAnalyticsPackMutation.data ? (
                    <div className="rounded-2xl border border-border bg-muted p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="font-semibold text-foreground">{runAnalyticsPackMutation.data.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">Scope: {runAnalyticsPackMutation.data.scopeLevel} · Period: {runAnalyticsPackMutation.data.period}</p>
                        </div>
                        <Badge variant="outline" className="border-success/25 bg-success/15 text-success">Analytics ready</Badge>
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
                          <div key={chart.title} className="h-48 rounded-xl border border-border bg-card p-3">
                            <p className="mb-2 text-sm font-semibold text-foreground">{chart.title}</p>
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
                          <div key={action} className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">{action}</div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-foreground">Recommended reports</p>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {catalog.templates
                        .filter((template) => !currentPack || currentPack.reportCodes.includes(template.code))
                        .map((template) => (
                          <button
                            key={template.code}
                            type="button"
                            onClick={() => applyTemplate(template)}
                            className={cn(
                              'rounded-xl border bg-card p-4 text-start transition hover:border-primary/50 hover:bg-primary/10',
                              selectedReportCodes.includes(template.code) ? 'border-primary bg-primary/10' : 'border-border',
                            )}
                          >
                            <p className="font-semibold text-foreground">{template.title}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{catalog.dataSources.find((source) => source.code === template.dataSource)?.title ?? template.dataSource}</p>
                            <Badge variant="outline" className="mt-3 border-border bg-muted text-muted-foreground">{template.visualization}</Badge>
                          </button>
                        ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-foreground">Underlying data catalog</p>
                    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
                      {Object.entries(sourceGroups).map(([category, sources]) => (
                        <div key={category} className="rounded-xl border border-border bg-card p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category}</p>
                          <div className="mt-2 space-y-2">
                            {sources.map((source) => (
                              <button
                                key={source.code}
                                type="button"
                                onClick={() => applyDataSource(source.code)}
                                className={cn(
                                  'w-full rounded-lg border px-3 py-2 text-start text-sm transition hover:border-primary/50',
                                  currentSource.code === source.code ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted text-foreground',
                                )}
                              >
                                <span className="font-medium">{source.title}</span>
                                <span className="mt-1 block text-xs text-muted-foreground">{source.metrics.length} metrics · {source.fields.length} fields</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-info/25 bg-muted">
                <CardHeader>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <CardTitle>BI Designer</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Build a report by choosing the business question, report type, dimensions, measures, filters, and connected HR data.
                      </p>
                    </div>
                    <Badge variant="outline" className="w-fit border-info/30 bg-card text-info">
                      Self-service builder
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-3 md:grid-cols-5">
                    {[
                      ['1', 'Data', currentSource.title],
                      ['2', 'Type', catalog.visualizationTypes.find((item) => item.code === visualizationForQuery)?.label ?? visualizationForQuery],
                      ['3', 'Dimensions', `${groupByForQuery.length} selected`],
                      ['4', 'Metrics', `${metricsForQuery.length} selected`],
                      ['5', 'Filters', `${Object.values(filterValues).filter((value) => value.trim()).length + 1} active`],
                    ].map(([step, label, value]) => (
                      <div key={step} className="rounded-xl border border-info/25 bg-card p-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{step}</span>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[1.05fr_1fr]">
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-info/25 bg-card p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-foreground">Business question</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {currentSmartCategory?.businessQuestions[0] ?? 'What HR decision should this report support?'}
                            </p>
                          </div>
                          <Badge variant="outline" className="w-fit border-border bg-muted text-muted-foreground">
                            {currentSource.category}
                          </Badge>
                        </div>
                        {currentSource.description ? (
                          <p className="mt-3 rounded-xl bg-muted p-3 text-sm text-muted-foreground">{currentSource.description}</p>
                        ) : null}
                      </div>

                      <div className="rounded-2xl border border-info/25 bg-card p-4">
                        <p className="text-sm font-semibold text-foreground">Choose a report type</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {catalog.visualizationTypes.map((item) => (
                            <button
                              key={item.code}
                              type="button"
                              onClick={() => setVisualization(item.code)}
                              className={cn(
                                'rounded-xl border px-3 py-2 text-start text-sm transition hover:border-primary/60 hover:bg-primary/10',
                                visualizationForQuery === item.code ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-foreground',
                              )}
                            >
                              <span className="font-semibold">{item.label}</span>
                              <span className="mt-1 block text-xs text-muted-foreground">
                                {item.code === 'matrix' ? 'Compare dimensions against metrics.' : item.code === 'comparison' ? 'Compare two segments side by side.' : item.code === 'line' ? 'Track movement over time.' : 'Use for this report output.'}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-info/25 bg-card p-4">
                        <p className="text-sm font-semibold text-foreground">Connected data model</p>
                        <div className="mt-3 space-y-2">
                          {visibleRelationships.slice(0, 3).map((relationship) => {
                            const nextSource = relationship.from === currentSource.code ? relationship.to : relationship.from;
                            const relatedSource = catalog.dataSources.find((source) => source.code === nextSource);
                            return (
                              <div key={relationship.code} className="rounded-xl border border-border bg-muted p-3">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div>
                                    <p className="text-sm font-semibold text-foreground">{relationship.title}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">{relationship.businessUse}</p>
                                  </div>
                                  {relatedSource ? (
                                    <Button variant="outline" size="sm" onClick={() => applyDataSource(relatedSource.code)}>
                                      Use {relatedSource.title}
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-info/25 bg-card p-4">
                        <p className="text-sm font-semibold text-foreground">Filter options</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                            Period: {filterPeriod}
                          </Badge>
                          {availableFilters.flatMap((filter) => filterOptionsFor(filter).slice(0, 3).map((option) => (
                            <Badge key={`${filter.code}-${option.code}`} variant="outline" className="border-border bg-card text-muted-foreground">
                              {filter.label}: {option.label}{option.count !== undefined ? ` (${option.count})` : ''}
                            </Badge>
                          )))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-info/25 bg-card p-4">
                      <p className="text-sm font-semibold text-foreground">Business dimensions</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {currentSource.groupBy.map((field) => (
                          <button
                            key={field.code}
                            type="button"
                            onClick={() => toggleCode(field.code, groupByForQuery, setSelectedGroupBy)}
                            className={cn(
                              'rounded-full border px-3 py-1.5 text-sm transition hover:border-warning/70',
                              groupByForQuery.includes(field.code) ? 'border-warning bg-warning/10 text-warning' : 'border-border bg-card text-muted-foreground',
                            )}
                          >
                            {field.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-info/25 bg-card p-4">
                      <p className="text-sm font-semibold text-foreground">Metric library</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {currentSource.metrics.map((metric) => (
                          <button
                            key={metric.code}
                            type="button"
                            onClick={() => toggleCode(metric.code, metricsForQuery, setSelectedMetrics)}
                            className={cn(
                              'rounded-full border px-3 py-1.5 text-sm transition hover:border-success/70',
                              metricsForQuery.includes(metric.code) ? 'border-success bg-success/10 text-success' : 'border-border bg-card text-muted-foreground',
                            )}
                          >
                            {metric.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <div className="grid gap-4 xl:grid-cols-[24rem_1fr]">
                <Card className="rounded-2xl border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-primary" />
                      Report Setup
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground" htmlFor="report-name">Report name</label>
                      <Input
                        id="report-name"
                        value={reportName}
                        onChange={(event) => setReportName(event.target.value)}
                        placeholder="Monthly attendance exceptions"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Underlying data</label>
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
                      <label className="text-sm font-medium text-foreground">Scope level</label>
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
                      <label className="text-sm font-medium text-foreground">Report population</label>
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
                        <p className="text-xs text-muted-foreground">{populationOptionsForScope.values.find((option) => option.code === populationValueForQuery)?.description}</p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Period</label>
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
                      <label className="text-sm font-medium text-foreground">Display</label>
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
                    {availableFilters.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">Report filters</p>
                        <div className="space-y-2">
                          {availableFilters.map((filter) => {
                            const value = filterValues[filter.code] ?? '';
                            const filterOptions = filterOptionsFor(filter);
                            if (filterOptions.length > 0) {
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
                                    {filterOptions.map((option) => (
                                      <SelectItem key={option.code} value={option.code}>
                                        {option.label}{option.count !== undefined ? ` (${option.count})` : ''}
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
                      <div className="rounded-xl border border-border bg-muted p-3 text-sm text-muted-foreground">No additional filters for this report source.</div>
                    )}
                    <div className="rounded-xl border border-border bg-muted p-3 text-sm text-muted-foreground">
                      <p className="font-semibold text-foreground">{currentSource.category}</p>
                      <p className="mt-1">{currentSource.title} supports {currentSource.scopeLevels.length} scope level(s) and {currentSource.metrics.length} metric(s).</p>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Card className="rounded-2xl border-border">
                    <CardHeader>
                      <CardTitle>Columns, Metrics, and Grouping</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 lg:grid-cols-3">
                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-foreground">Columns</p>
                        <div className="space-y-2">
                          {currentSource.fields.map((field) => (
                            <label key={field.code} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-primary"
                                checked={fieldsForQuery.includes(field.code)}
                                onChange={() => toggleCode(field.code, fieldsForQuery, setSelectedFields)}
                              />
                              {field.label}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-foreground">Metrics</p>
                        <div className="space-y-2">
                          {currentSource.metrics.map((metric) => (
                            <label key={metric.code} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-success"
                                checked={metricsForQuery.includes(metric.code)}
                                onChange={() => toggleCode(metric.code, metricsForQuery, setSelectedMetrics)}
                              />
                              {metric.label}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-foreground">Group by</p>
                        <div className="space-y-2">
                          {currentSource.groupBy.map((field) => (
                            <label key={field.code} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-warning"
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
                    <Card className="rounded-2xl border-border">
                      <CardHeader>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <CardTitle className="flex items-center gap-2">
                            <Eye className="h-5 w-5 text-primary" />
                            Preview
                          </CardTitle>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              onClick={() => previewMutation.mutate()}
                              disabled={previewMutation.isPending || !currentSource}
                            >
                              <Eye className="me-2 h-4 w-4" />
                              Preview
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => semanticQueryMutation.mutate()}
                              disabled={semanticQueryMutation.isPending || !currentSource}
                            >
                              <BarChart3 className="me-2 h-4 w-4" />
                              Run Report
                            </Button>
                            <Button
                              onClick={() => saveReportMutation.mutate()}
                              disabled={saveReportMutation.isPending || !currentSource}
                              className="bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                              <Save className="me-2 h-4 w-4" />
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
                              <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                                {previewMutation.data.warnings.join(' ')}
                              </div>
                            ) : null}
                            <div className="h-56 rounded-xl border border-border bg-card p-3">
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
                            <div className="overflow-x-auto rounded-xl border border-border">
                              <table className="w-full text-start text-sm">
                                <thead className="bg-muted text-muted-foreground">
                                  <tr>
                                    {Object.keys(previewMutation.data.sampleRows[0] ?? {}).map((column) => (
                                      <th key={column} className="px-3 py-2 font-semibold">{column}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                  {previewMutation.data.sampleRows.map((row, index) => (
                                    <tr key={index}>
                                      {Object.entries(row).map(([column, value]) => (
                                        <td key={column} className="px-3 py-2 text-foreground">{value}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        ) : (
                          <div className="flex min-h-[18rem] items-center justify-center rounded-xl border border-dashed border-border bg-muted text-center text-sm text-muted-foreground">
                            Choose the report data and click Preview to see sample rows and chart output.
                          </div>
                        )}
                        {semanticQueryMutation.data ? (
                          <div className="space-y-4 rounded-2xl border border-info/25 bg-info/10 p-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <p className="text-lg font-semibold text-foreground">Semantic Query Result</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {semanticQueryMutation.data.sourceTitle} · {semanticQueryMutation.data.scopeLevel}
                                </p>
                              </div>
                              <Badge variant="outline" className="border-info/30 bg-card text-info">
                                {semanticQueryMutation.data.executionPlan.privacyLevel}
                              </Badge>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-3">
                              {semanticQueryMutation.data.insightCards.map((card) => (
                                <div key={card.label} className={cn('rounded-xl border p-3', highlightTone(card.tone))}>
                                  <p className="text-xs font-semibold uppercase tracking-wide">{card.label}</p>
                                  <p className="mt-2 text-2xl font-bold">{card.value}</p>
                                </div>
                              ))}
                            </div>
                            <div className="grid gap-3 text-sm lg:grid-cols-3">
                              <div className="rounded-xl border border-info/30 bg-card p-3">
                                <p className="text-muted-foreground">Data grain</p>
                                <p className="font-semibold text-foreground">{semanticQueryMutation.data.executionPlan.grain}</p>
                              </div>
                              <div className="rounded-xl border border-info/30 bg-card p-3">
                                <p className="text-muted-foreground">Drilldowns</p>
                                <p className="font-semibold text-foreground">{semanticQueryMutation.data.executionPlan.availableDrilldowns.slice(0, 3).join(', ')}</p>
                              </div>
                              <div className="rounded-xl border border-info/30 bg-card p-3">
                                <p className="text-muted-foreground">Filters</p>
                                <p className="font-semibold text-foreground">
                                  {semanticQueryMutation.data.executionPlan.appliedFilters.length > 0
                                    ? semanticQueryMutation.data.executionPlan.appliedFilters.map((filter) => `${filter.code}: ${filter.value}`).join(', ')
                                    : 'No extra filters'}
                                </p>
                              </div>
                            </div>
                            <div className="rounded-2xl border border-info/30 bg-card p-4">
                              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                <div>
                                  <p className="text-base font-semibold text-foreground">Decision Support</p>
                                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{semanticQueryMutation.data.decisionSupport.summary}</p>
                                </div>
                                <Badge variant="outline" className="w-fit border-primary/30 bg-primary/10 text-primary">
                                  BI guidance
                                </Badge>
                              </div>
                              <div className="mt-4 grid gap-3 xl:grid-cols-3">
                                <div className="rounded-xl border border-border bg-muted p-3">
                                  <p className="text-sm font-semibold text-foreground">Top segments</p>
                                  <div className="mt-3 space-y-2">
                                    {semanticQueryMutation.data.decisionSupport.topSegments.map((segment) => (
                                      <div key={`${segment.label}-${segment.metric}`} className="rounded-lg bg-card p-3 text-sm">
                                        <div className="flex items-center justify-between gap-3">
                                          <p className="font-semibold text-foreground">{segment.label}</p>
                                          <Badge variant="outline" className={cn('border', segment.severity === 'risk' ? 'border-destructive/30 bg-destructive/15 text-destructive' : segment.severity === 'watch' ? 'border-warning/30 bg-warning/10 text-warning' : 'border-success/30 bg-success/10 text-success')}>
                                            {segment.severity}
                                          </Badge>
                                        </div>
                                        <p className="mt-1 text-muted-foreground">{segment.metric}: {segment.value} · {segment.shareOfTotal}%</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="rounded-xl border border-border bg-muted p-3">
                                  <p className="text-sm font-semibold text-foreground">Suggested drilldowns</p>
                                  <div className="mt-3 space-y-2">
                                    {semanticQueryMutation.data.decisionSupport.recommendedDrilldowns.map((drilldown) => (
                                      <div key={drilldown.field} className="rounded-lg bg-card p-3 text-sm">
                                        <p className="font-semibold text-foreground">{drilldown.label}</p>
                                        <p className="mt-1 text-muted-foreground">{drilldown.reason}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="rounded-xl border border-border bg-muted p-3">
                                  <p className="text-sm font-semibold text-foreground">Next actions</p>
                                  <div className="mt-3 space-y-2">
                                    {semanticQueryMutation.data.decisionSupport.nextActions.map((action) => (
                                      <div key={`${action.actionType}-${action.label}`} className="rounded-lg bg-card p-3 text-sm">
                                        <p className="font-semibold text-foreground">{action.label}</p>
                                        <p className="mt-1 text-muted-foreground">{action.reason}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                            {semanticQueryMutation.data.pivotBreakdowns.length > 0 ? (
                              <div className="rounded-2xl border border-info/30 bg-card p-4">
                                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                  <div>
                                    <p className="text-base font-semibold text-foreground">Explore other cuts</p>
                                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                      Compare the same result by other business dimensions without rebuilding the report.
                                    </p>
                                  </div>
                                  <Badge variant="outline" className="w-fit border-info/30 bg-info/10 text-info">
                                    Smart pivots
                                  </Badge>
                                </div>
                                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                  {semanticQueryMutation.data.pivotBreakdowns.slice(0, 6).map((breakdown) => (
                                    <div key={breakdown.field} className="rounded-xl border border-border bg-muted p-3">
                                      <div className="flex items-center justify-between gap-3">
                                        <div>
                                          <p className="text-sm font-semibold text-foreground">{breakdown.label}</p>
                                          <p className="mt-1 text-xs text-muted-foreground">{breakdown.metric}</p>
                                        </div>
                                        <Badge variant="outline" className="border-border bg-card text-muted-foreground">
                                          {breakdown.totalSegments} segments
                                        </Badge>
                                      </div>
                                      <div className="mt-3 space-y-2">
                                        {breakdown.segments.slice(0, 3).map((segment) => (
                                          <div key={`${breakdown.field}-${segment.label}`} className="rounded-lg bg-card p-3 text-sm">
                                            <div className="flex items-center justify-between gap-3">
                                              <p className="font-semibold text-foreground">{segment.label}</p>
                                              <Badge variant="outline" className={cn('border', segment.severity === 'risk' ? 'border-destructive/30 bg-destructive/15 text-destructive' : segment.severity === 'watch' ? 'border-warning/30 bg-warning/10 text-warning' : 'border-success/30 bg-success/10 text-success')}>
                                                {segment.severity}
                                              </Badge>
                                            </div>
                                            <p className="mt-1 text-muted-foreground">{segment.value} · {segment.shareOfTotal}%</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                            {semanticQueryMutation.data.warnings.length > 0 ? (
                              <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                                {semanticQueryMutation.data.warnings.join(' ')}
                              </div>
                            ) : null}
                            <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                              <div className="h-56 rounded-xl border border-info/30 bg-card p-3">
                                <p className="mb-2 text-sm font-semibold text-foreground">Dashboard preview</p>
                                <ResponsiveContainer width="100%" height="85%">
                                  <BarChart data={semanticQueryMutation.data.chartData} margin={{ top: 8, right: 8, left: 0, bottom: 28 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="label" angle={-20} textAnchor="end" interval={0} height={50} tick={{ fontSize: 10 }} />
                                    <YAxis allowDecimals={false} />
                                    <Tooltip />
                                    <Bar dataKey="value" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                              <div className="overflow-x-auto rounded-xl border border-info/30 bg-card">
                                <p className="border-b border-info/25 px-3 py-2 text-sm font-semibold text-foreground">Aggregate result</p>
                                <table className="w-full text-start text-sm">
                                  <thead className="bg-muted text-muted-foreground">
                                    <tr>
                                      {semanticQueryMutation.data.columns.map((column) => (
                                        <th key={column} className="px-3 py-2 font-semibold">{column}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border">
                                    {semanticQueryMutation.data.rows.map((row, index) => (
                                      <tr key={index}>
                                        {semanticQueryMutation.data.columns.map((column) => (
                                          <td key={column} className="px-3 py-2 text-foreground">{row[column] ?? ''}</td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-info/30 bg-card">
                              <p className="border-b border-info/25 px-3 py-2 text-sm font-semibold text-foreground">Underlying records</p>
                              <table className="w-full text-start text-sm">
                                <thead className="bg-muted text-muted-foreground">
                                  <tr>
                                    {Object.keys(semanticQueryMutation.data.drillThroughRows[0] ?? {}).map((column) => (
                                      <th key={column} className="px-3 py-2 font-semibold">{column}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                  {semanticQueryMutation.data.drillThroughRows.map((row, index) => (
                                    <tr key={index}>
                                      {Object.entries(row).map(([column, value]) => (
                                        <td key={column} className="px-3 py-2 text-foreground">{value}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-border">
                      <CardHeader>
                        <CardTitle>Builder Summary</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Data</p>
                          <p className="font-semibold text-foreground">{currentSource.title}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Columns</p>
                          <p className="text-foreground">{fieldLabels(currentSource, fieldsForQuery)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Metrics</p>
                          <p className="text-foreground">{fieldLabels(currentSource, metricsForQuery)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Group by</p>
                          <p className="text-foreground">{fieldLabels(currentSource, groupByForQuery)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Scope</p>
                          <p className="font-semibold text-foreground">{catalog.scopeLevels.find((scope) => scope.code === scopeForQuery)?.label ?? scopeForQuery}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Population</p>
                          <p className="font-semibold text-foreground">{populationLabelForQuery}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Filters</p>
                          <p className="text-foreground">
                            {[`Period: ${filterPeriod}`, ...Object.entries(filterValues).filter(([, value]) => value.trim()).map(([code, value]) => `${code}: ${value}`)].join(', ')}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="rounded-2xl border-border">
                    <CardHeader>
                      <CardTitle>Calculated Fields</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="calculated-field-name">Metric name</label>
                        <Input id="calculated-field-name" value={calculatedFieldName} onChange={(event) => setCalculatedFieldName(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="calculated-field-expression">Formula</label>
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
                              <Badge key={field.calculatedFieldId ?? field.id ?? index} variant="outline" className="border-border bg-muted text-muted-foreground">
                                {field.fieldName ?? 'Calculated field'} · {field.status ?? 'DRAFT'}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No calculated fields yet.</p>
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
                <Card className="rounded-2xl border-border">
                  <CardHeader>
                    <CardTitle>Business Data Domains</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Object.entries(sourceGroups).map(([category, sources]) => (
                      <div key={category} className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category}</p>
                        {sources.map((source) => (
                          <button
                            key={source.code}
                            type="button"
                            onClick={() => applyDataSource(source.code)}
                            className={cn(
                              'w-full rounded-xl border p-3 text-start transition hover:border-primary/50 hover:bg-primary/10',
                              currentSource.code === source.code ? 'border-primary bg-primary/10' : 'border-border bg-card',
                            )}
                          >
                            <p className="font-semibold text-foreground">{source.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{source.metrics.length} measures · {source.fields.length} detail fields</p>
                          </button>
                        ))}
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Card className="rounded-2xl border-border">
                    <CardHeader>
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <CardTitle>{currentSource.title}</CardTitle>
                          <p className="mt-2 text-sm text-muted-foreground">{currentSource.category}</p>
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
                      <div className="rounded-xl border border-border bg-muted p-4">
                        <p className="text-sm font-semibold text-foreground">Available fields</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {currentSource.fields.map((field) => (
                            <Badge key={field.code} variant="outline" className="border-border bg-card text-muted-foreground">{field.label}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border bg-muted p-4">
                        <p className="text-sm font-semibold text-foreground">Available measures</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {currentSource.metrics.map((metric) => (
                            <Badge key={metric.code} variant="outline" className="border-success/30 bg-card text-success">{metric.label}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border bg-muted p-4">
                        <p className="text-sm font-semibold text-foreground">Break down by</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {currentSource.groupBy.map((field) => (
                            <Badge key={field.code} variant="outline" className="border-warning/30 bg-card text-warning">{field.label}</Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <Card className="rounded-2xl border-border">
                      <CardHeader>
                        <CardTitle>How This Data Connects</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {visibleRelationships.length > 0 ? visibleRelationships.map((relationship) => {
                          const fromSource = catalog.dataSources.find((source) => source.code === relationship.from);
                          const toSource = catalog.dataSources.find((source) => source.code === relationship.to);
                          return (
                            <div key={relationship.code} className="rounded-xl border border-border bg-card p-4">
                              <p className="font-semibold text-foreground">{relationship.title}</p>
                              <p className="mt-2 text-sm leading-6 text-muted-foreground">{relationship.businessUse}</p>
                              <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Feeds from</p>
                                  <p className="font-medium text-foreground">{fromSource?.title ?? relationship.from}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Used by</p>
                                  <p className="font-medium text-foreground">{toSource?.title ?? relationship.to}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Produces</p>
                                  <p className="font-medium text-foreground">{relationship.relationship}</p>
                                </div>
                              </div>
                              <div className="mt-4 grid gap-3 text-sm lg:grid-cols-2">
                                <div className="rounded-lg border border-border bg-muted p-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Data grain</p>
                                  <p className="mt-1 text-foreground">{relationship.grain ?? 'Business process record'}</p>
                                </div>
                                <div className="rounded-lg border border-border bg-muted p-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Privacy</p>
                                  <p className="mt-1 text-foreground">{relationship.privacyLevel ?? 'standard'}</p>
                                </div>
                              </div>
                              {relationship.joinKeys && relationship.joinKeys.length > 0 ? (
                                <div className="mt-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Join keys</p>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {relationship.joinKeys.map((key) => (
                                      <Badge key={key} variant="outline" className="border-border bg-muted text-muted-foreground">{key}</Badge>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                              {relationship.lineage && relationship.lineage.length > 0 ? (
                                <div className="mt-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lineage</p>
                                  <p className="mt-1 text-sm text-muted-foreground">{relationship.lineage.join(' -> ')}</p>
                                </div>
                              ) : null}
                              {relationship.recommendedDrilldowns && relationship.recommendedDrilldowns.length > 0 ? (
                                <div className="mt-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended drilldowns</p>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {relationship.recommendedDrilldowns.map((drilldown) => (
                                      <Badge key={drilldown} variant="outline" className="border-success/30 bg-success/10 text-success">{drilldown}</Badge>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        }) : (
                          <div className="rounded-xl border border-dashed border-border bg-muted p-6 text-sm text-muted-foreground">
                            No direct cross-module relationship is configured for this data domain yet.
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-border">
                      <CardHeader>
                        <CardTitle>Reports and Smart Analytics</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Recommended report templates</p>
                          <div className="mt-3 space-y-2">
                            {templatesForCurrentSource.length > 0 ? templatesForCurrentSource.map((template) => (
                              <button
                                key={template.code}
                                type="button"
                                onClick={() => {
                                  applyTemplate(template);
                                  setActiveTab('builder');
                                }}
                                className="w-full rounded-xl border border-border bg-card p-3 text-start transition hover:border-primary/50 hover:bg-primary/10"
                              >
                                <p className="font-semibold text-foreground">{template.title}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{template.metrics.length} measures · {template.groupBy.length} breakdowns · {template.visualization}</p>
                              </button>
                            )) : (
                              <p className="rounded-xl border border-dashed border-border bg-muted p-4 text-sm text-muted-foreground">No templates yet for this data domain.</p>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">Smart categories using this data</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {smartCategoriesForCurrentSource.length > 0 ? smartCategoriesForCurrentSource.map((category) => (
                              <button
                                key={category.code}
                                type="button"
                                onClick={() => {
                                  applySmartCategory(category);
                                  setActiveTab('analytics');
                                }}
                                className="rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                              >
                                {category.title}
                              </button>
                            )) : (
                              <span className="rounded-full border border-border bg-muted px-3 py-1.5 text-sm text-muted-foreground">No smart category yet</span>
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
            <Card className="rounded-2xl border-border">
              <CardHeader>
                <CardTitle>Delivery Settings</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-[14rem_1fr]">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Frequency</label>
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
                  <label className="text-sm font-medium text-foreground" htmlFor="schedule-recipients">Recipients</label>
                  <Input
                    id="schedule-recipients"
                    value={scheduleRecipients}
                    onChange={(event) => setScheduleRecipients(event.target.value)}
                    placeholder="hr.operations@example.com, finance@example.com"
                  />
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
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
                      const reportId = reportDefinitionId(report);
                      const executions = (reportExecutionsQuery.data ?? [])
                        .filter((execution) => reportExecutionDefinitionId(execution) === reportId)
                        .slice(0, 3);
                      const showHistory = expandedReportId === reportId || executions.length > 0;
                      return (
                        <div key={report.reportDefinitionId ?? report.id ?? index} className="rounded-xl border border-border bg-card p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-foreground">{report.reportName ?? report.name ?? 'Saved report'}</p>
                              <p className="mt-1 text-sm text-muted-foreground">{source?.title ?? report.dataSource ?? 'HR data'}</p>
                            </div>
                            <Badge variant="outline" className="border-border bg-muted text-muted-foreground">{report.status ?? 'DRAFT'}</Badge>
                          </div>
                          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
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
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={!reportId}
                              onClick={() => setExpandedReportId(expandedReportId === reportId ? undefined : reportId)}
                            >
                              History
                            </Button>
                          </div>
                          {showHistory ? (
                            <div className="mt-4 rounded-xl border border-border bg-muted p-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-foreground">Execution history</p>
                                {reportExecutionsQuery.isFetching ? (
                                  <span className="text-xs text-muted-foreground">Refreshing...</span>
                                ) : null}
                              </div>
                              {executions.length > 0 ? (
                                <div className="mt-3 space-y-2">
                                  {executions.map((execution) => (
                                    <div key={execution.reportExecutionId ?? execution.id ?? `${reportId}-${execution.status}`} className="rounded-lg border border-border bg-card p-3 text-sm">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className="border-info/30 bg-info/10 text-info">
                                            {execution.status ?? 'RUN'}
                                          </Badge>
                                          <span className="text-muted-foreground">{formatExecutionTime(execution)}</span>
                                        </div>
                                        <span className="font-semibold text-foreground">{execution.rowCount ?? execution.resultPayload?.drillThroughCount ?? 0} rows</span>
                                      </div>
                                      {execution.resultPayload ? (
                                        <p className="mt-2 text-xs text-muted-foreground">
                                          {execution.resultPayload.sourceTitle} result saved with {execution.resultPayload.drillThroughCount} underlying records.
                                        </p>
                                      ) : execution.resultUrl ? (
                                        <p className="mt-2 text-xs text-muted-foreground">Result stored for download or delivery.</p>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-3 text-sm text-muted-foreground">No execution history yet. Run the report to generate a saved result.</p>
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-muted p-6 text-sm text-muted-foreground">
                    No saved reports yet. Use Builder to create one from any HR data source.
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-success" />
                  Migration Templates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {migrationTemplates.map((template) => (
                    <div key={template.module} className="rounded-xl border border-border bg-muted p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">{template.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{template.owner}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadCsv(`/reporting/module-import-template.csv?module=${template.module}`, `${template.module}-import-template.csv`)}
                        >
                          <Download className="me-2 h-4 w-4" />
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
              <Card key={report.code} className="rounded-2xl border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{report.title}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">{report.category}</p>
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
                      <p className="text-muted-foreground">Activity</p>
                      <p className="text-xl font-bold text-foreground">{report.activity}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Issues</p>
                      <p className="text-xl font-bold text-foreground">{report.issues}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <BellRing className="h-4 w-4 text-primary" />
                      <span>{report.notifications} notifications</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-success" />
                      <span>{report.workflowTransitions} workflows</span>
                    </div>
                    <div className="col-span-2 text-muted-foreground">
                      Last activity: {report.lastActivityAt ? new Date(report.lastActivityAt).toLocaleString() : 'No activity yet'}
                    </div>
                    {report.services && report.services.length > 0 ? (
                      <p className="col-span-2 text-xs font-medium text-muted-foreground">Connected services: {report.services.slice(0, 3).join(', ')}</p>
                    ) : null}
                    {report.analyticsOutputs && report.analyticsOutputs.length > 0 ? (
                      <div className="col-span-2 flex flex-wrap gap-2">
                        {report.analyticsOutputs.slice(0, 4).map((output) => (
                          <Badge key={output} variant="outline" className="border-border bg-card text-muted-foreground">
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

            <Card className="rounded-2xl border-border">
              <CardHeader>
                <CardTitle>Top Report Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {topReports.map((report) => (
                  <div key={report.code} className="grid gap-2 rounded-xl bg-muted p-3 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <p className="font-semibold text-foreground">{report.title}</p>
                      <p className="text-sm text-muted-foreground">{report.commands} commands, {report.events} events, {report.notifications} notifications</p>
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
    </div>
  );
}
