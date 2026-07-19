import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, PlayCircle, Plus, Save, ShieldCheck } from 'lucide-react';
import { useApiQuery } from '@/hooks/use-api';
import { apiClient } from '@/lib/api-client';
import { useTenant } from '@/hooks/use-tenant';
import { useUIStore } from '@/stores/ui-store';
import { BusinessMetric, BusinessPageHeader, SectionHeading } from '@/components/common/business-page';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DEFAULT_GENERIC_LEAVE_POLICY_CODE,
  RULE_LEDGER_RETRO_BEHAVIORS,
  buildDraftConfigFromGenericRules,
  getRuleLedgerCategories,
  isRuleLedgerSupportedArea,
  type RuleLedgerRetroBehavior,
} from '@/lib/policy-center-controls';

type PolicyArea =
  | 'EMPLOYEE_SETUP'
  | 'LEAVE'
  | 'ATTENDANCE'
  | 'PAYROLL'
  | 'ACCESS_GOVERNANCE'
  | 'COUNTRY_POLICY'
  | 'COMPLIANCE'
  | 'BENEFITS'
  | 'GLOBAL_HR'
  | 'DEI_ANALYTICS'
  | 'ENGAGEMENT';

type PolicyStatus = 'DRAFT' | 'IN_REVIEW' | 'REVIEWED' | 'APPROVED' | 'PUBLISHED' | 'APPLIED' | 'REJECTED' | 'ARCHIVED';

type PolicyScope = {
  tenantId?: string;
  countryCodes?: string[];
  legalEntityIds?: string[];
  orgUnitIds?: string[];
  departmentIds?: string[];
  jobCodes?: string[];
  gradeCodes?: string[];
  locationCodes?: string[];
  employeeTypes?: string[];
  workerIds?: string[];
  effectiveFrom?: string;
  effectiveUntil?: string;
};

type PolicyValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

type PolicySimulationResult = {
  impactedEmployees: number;
  pendingRecords?: Record<string, number>;
  riskSummary?: {
    safe: number;
    warning: number;
    blocked: number;
    retroactiveAdjustmentRequired: number;
  };
  notificationPreview?: {
    totalRecipients: number;
  };
  warnings?: string[];
};

type PolicyRevision = {
  id: string;
  area: PolicyArea;
  title: string;
  status: PolicyStatus;
  scope: PolicyScope;
  draftConfig: Record<string, unknown>;
  validationResult?: PolicyValidationResult;
  simulationResult?: PolicySimulationResult;
  updatedAt: string;
};

type PolicyTemplate = {
  area: PolicyArea;
  code: string;
  title: string;
  description: string;
  draftConfig: Record<string, unknown>;
  recommendedScope: Partial<PolicyScope>;
};

type PolicySummary = {
  totalRevisions: number;
  byStatus: Record<string, number>;
  byArea: Record<string, number>;
};

type RuleRow = {
  code: string;
  condition: string;
  outcome: string;
  value: string;
  category: string;
  retroBehavior: RuleLedgerRetroBehavior;
};

type BuilderForm = {
  title: string;
  area: PolicyArea;
  countries: string;
  legalEntities: string;
  orgUnits: string;
  departments: string;
  jobs: string;
  grades: string;
  locations: string;
  employeeTypes: string;
  workers: string;
  effectiveFrom: string;
  effectiveUntil: string;
  rules: RuleRow[];
  /** Structured draftConfig picked up from a template; the generic rule ledger merges on top of this. */
  baseDraftConfig: Record<string, unknown>;
  /** Which leave policy (by code) the generic rule builder attaches ledger rules to, for LEAVE only. */
  leavePolicyCode: string;
};

const policyAreas: PolicyArea[] = [
  'LEAVE',
  'ATTENDANCE',
  'PAYROLL',
  'ACCESS_GOVERNANCE',
  'COMPLIANCE',
  'BENEFITS',
  'COUNTRY_POLICY',
  'EMPLOYEE_SETUP',
  'GLOBAL_HR',
  'DEI_ANALYTICS',
  'ENGAGEMENT',
];

function createRuleRow(area: PolicyArea, code = 'DEFAULT_RULE'): RuleRow {
  const categories = getRuleLedgerCategories(area);
  return {
    code,
    condition: 'All eligible workers',
    outcome: 'ALLOW',
    value: '',
    category: categories[0]?.key ?? '',
    retroBehavior: 'FUTURE_ONLY',
  };
}

const initialForm: BuilderForm = {
  title: '',
  area: 'LEAVE',
  countries: '',
  legalEntities: '',
  orgUnits: '',
  departments: '',
  jobs: '',
  grades: '',
  locations: '',
  employeeTypes: '',
  workers: '',
  effectiveFrom: '',
  effectiveUntil: '',
  rules: [createRuleRow('LEAVE')],
  baseDraftConfig: {},
  leavePolicyCode: DEFAULT_GENERIC_LEAVE_POLICY_CODE,
};

function splitList(value: string): string[] | undefined {
  const items = value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function buildScope(form: BuilderForm, tenantId?: string): PolicyScope {
  return {
    tenantId,
    countryCodes: splitList(form.countries),
    legalEntityIds: splitList(form.legalEntities),
    orgUnitIds: splitList(form.orgUnits),
    departmentIds: splitList(form.departments),
    jobCodes: splitList(form.jobs),
    gradeCodes: splitList(form.grades),
    locationCodes: splitList(form.locations),
    employeeTypes: splitList(form.employeeTypes),
    workerIds: splitList(form.workers),
    effectiveFrom: form.effectiveFrom || undefined,
    effectiveUntil: form.effectiveUntil || undefined,
  };
}

function buildDraftConfig(form: BuilderForm): Record<string, unknown> {
  if (!isRuleLedgerSupportedArea(form.area)) {
    // The generic condition/outcome rule builder is hidden for this area (see
    // PolicyBuilderForm), so only the template-provided structured config applies.
    return form.baseDraftConfig;
  }
  const rules = form.rules.map((rule, index) => ({
    code: rule.code || `RULE_${index + 1}`,
    label: rule.condition || 'All eligible workers',
    category: rule.category,
    action: rule.outcome || 'ALLOW',
    value: rule.value,
    retroBehavior: rule.retroBehavior,
  }));
  return buildDraftConfigFromGenericRules(form.area, form.baseDraftConfig, rules, {
    leavePolicyCode: form.leavePolicyCode,
  });
}

function statusVariant(status: PolicyStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'APPLIED' || status === 'PUBLISHED') return 'default';
  if (status === 'REJECTED' || status === 'ARCHIVED') return 'destructive';
  if (status === 'APPROVED' || status === 'REVIEWED') return 'secondary';
  return 'outline';
}

function listSummary(scope: PolicyScope, labels: { tenantDefault: string; entities: string; departments: string; workers: string }): string {
  return [
    scope.countryCodes?.join(', '),
    scope.legalEntityIds?.length ? `${scope.legalEntityIds.length} ${labels.entities}` : undefined,
    scope.departmentIds?.length ? `${scope.departmentIds.length} ${labels.departments}` : undefined,
    scope.workerIds?.length ? `${scope.workerIds.length} ${labels.workers}` : undefined,
  ].filter(Boolean).join(' · ') || labels.tenantDefault;
}

export function AdminPolicies() {
  const { t } = useTranslation();
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);
  const [form, setForm] = React.useState<BuilderForm>(initialForm);
  const [selectedRevisionId, setSelectedRevisionId] = React.useState<string>('');
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const { data: summary, isLoading: summaryLoading } = useApiQuery<PolicySummary>(
    ['policy-summary', tenantId],
    '/admin/policies/summary',
    { enabled: Boolean(tenantId) },
  );
  const { data: revisionsData, isLoading, isError, error, refetch } = useApiQuery<PolicyRevision[]>(
    ['policy-revisions', tenantId],
    '/admin/policies/revisions',
    { enabled: Boolean(tenantId) },
  );
  const { data: templatesData } = useApiQuery<PolicyTemplate[]>(
    ['policy-templates', tenantId],
    '/admin/policies/templates',
    { enabled: Boolean(tenantId) },
  );

  const revisions = React.useMemo(() => revisionsData ?? [], [revisionsData]);
  const templates = React.useMemo(() => templatesData ?? [], [templatesData]);
  const selectedRevision = React.useMemo(
    () => revisions.find((revision) => revision.id === selectedRevisionId),
    [revisions, selectedRevisionId],
  );
  const scopeLabels = React.useMemo(() => ({
    tenantDefault: t('lowCode.policies.scope.tenantDefault'),
    entities: t('lowCode.policies.scope.entities'),
    departments: t('lowCode.policies.scope.departments'),
    workers: t('lowCode.policies.scope.workers'),
  }), [t]);

  const notifySuccess = (title: string, message: string) => {
    addNotification({ title, message, type: 'success', read: false });
    refetch();
  };

  const notifyError = (title: string, fallback: string, mutationError: unknown) => {
    const message = mutationError instanceof Error ? mutationError.message : fallback;
    addNotification({ title, message, type: 'error', read: false });
  };

  const invalidatePolicies = () => {
    queryClient.invalidateQueries({ queryKey: ['policy-revisions', tenantId] });
    queryClient.invalidateQueries({ queryKey: ['policy-summary', tenantId] });
  };

  const createMutation = useMutation({
    mutationFn: async (payload: { area: PolicyArea; title: string; scope: PolicyScope; draftConfig: Record<string, unknown> }) => {
      const response = await apiClient.post<{ data: PolicyRevision }>('/admin/policies/revisions', payload);
      return response.data.data;
    },
      onSuccess: (revision) => {
        setSelectedRevisionId(revision.id);
        setDialogOpen(false);
        invalidatePolicies();
        notifySuccess(t('lowCode.policies.savedTitle'), t('lowCode.policies.savedMessage'));
      },
      onError: (mutationError) => notifyError(t('lowCode.policies.saveFailedTitle'), t('lowCode.policies.saveFailedMessage'), mutationError),
    });

  const updateMutation = useMutation({
    mutationFn: async (vars: { id: string; payload: { title: string; scope: PolicyScope; draftConfig: Record<string, unknown> } }) => {
      const response = await apiClient.patch<{ data: PolicyRevision }>(`/admin/policies/revisions/${vars.id}`, vars.payload);
      return response.data.data;
    },
      onSuccess: (revision) => {
        setSelectedRevisionId(revision.id);
        invalidatePolicies();
        notifySuccess(t('lowCode.policies.savedTitle'), t('lowCode.policies.savedMessage'));
      },
      onError: (mutationError) => notifyError(t('lowCode.policies.saveFailedTitle'), t('lowCode.policies.saveFailedMessage'), mutationError),
    });

  const lifecycleMutation = useMutation({
    mutationFn: async (vars: { id: string; action: string; body?: Record<string, unknown> }) => {
      const url = vars.action === 'validate' || vars.action === 'simulate'
        ? `/admin/policies/revisions/${vars.id}/${vars.action}`
        : `/admin/policies/revisions/${vars.id}/commands/${vars.action}`;
      const response = await apiClient.post<{ data: PolicyRevision }>(url, vars.body ?? {});
      return response.data.data;
    },
      onSuccess: (revision) => {
        setSelectedRevisionId(revision.id);
        invalidatePolicies();
        notifySuccess(t('lowCode.policies.actionCompleteTitle'), t('lowCode.policies.actionCompleteMessage'));
      },
      onError: (mutationError) => notifyError(t('lowCode.policies.actionFailedTitle'), t('lowCode.policies.actionFailedMessage'), mutationError),
    });

  const applyTemplate = (template: PolicyTemplate) => {
    setForm((current) => ({
      ...current,
      title: template.title,
      area: template.area,
      countries: template.recommendedScope.countryCodes?.join(', ') ?? '',
      legalEntities: template.recommendedScope.legalEntityIds?.join(', ') ?? '',
      orgUnits: template.recommendedScope.orgUnitIds?.join(', ') ?? '',
      departments: template.recommendedScope.departmentIds?.join(', ') ?? '',
      jobs: template.recommendedScope.jobCodes?.join(', ') ?? '',
      grades: template.recommendedScope.gradeCodes?.join(', ') ?? '',
      locations: template.recommendedScope.locationCodes?.join(', ') ?? '',
      employeeTypes: template.recommendedScope.employeeTypes?.join(', ') ?? '',
      workers: template.recommendedScope.workerIds?.join(', ') ?? '',
      effectiveFrom: template.recommendedScope.effectiveFrom ?? '',
      effectiveUntil: template.recommendedScope.effectiveUntil ?? '',
      // The template's own structured draftConfig is the real base; any generic
      // rules the admin adds afterward merge into it (see buildDraftConfig).
      baseDraftConfig: template.draftConfig ?? {},
      rules: [createRuleRow(template.area)],
    }));
  };

  const saveDraft = () => {
    const payload = {
      area: form.area,
      title: form.title || t('lowCode.policies.untitledPolicy'),
      scope: buildScope(form, tenantId),
      draftConfig: buildDraftConfig(form),
    };
    if (selectedRevision?.status === 'DRAFT') {
      updateMutation.mutate({ id: selectedRevision.id, payload });
      return;
    }
    createMutation.mutate(payload);
  };

  const lifecycle = (action: string, body?: Record<string, unknown>) => {
    if (!selectedRevision) return;
    lifecycleMutation.mutate({ id: selectedRevision.id, action, body });
  };

  const columns = React.useMemo<DataTableColumn<PolicyRevision>[]>(() => [
    {
      key: 'title',
      header: t('lowCode.policies.table.title'),
      cell: (row) => (
        <button className="text-left font-semibold text-primary hover:underline" type="button" onClick={() => setSelectedRevisionId(row.id)}>
          {row.title}
        </button>
      ),
    },
    { key: 'area', header: t('lowCode.policies.table.area'), cell: (row) => row.area.replace(/_/g, ' ') },
    { key: 'status', header: t('lowCode.policies.table.status'), cell: (row) => <Badge variant={statusVariant(row.status)}>{row.status}</Badge> },
    { key: 'scope', header: t('lowCode.policies.table.scope'), cell: (row) => listSummary(row.scope, scopeLabels) },
    {
      key: 'impact',
      header: t('lowCode.policies.table.impact'),
      cell: (row) => row.simulationResult ? `${row.simulationResult.impactedEmployees} ${t('lowCode.policies.people')}` : '-',
    },
  ], [scopeLabels, t]);

  return (
    <div className="space-y-6 p-6">
      <BusinessPageHeader
        eyebrow={t('lowCode.policies.eyebrow')}
        icon={ShieldCheck}
        title={t('lowCode.policies.title')}
        subtitle={t('lowCode.policies.subtitle')}
        actions={(
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button">
                <Plus className="mr-2 h-4 w-4" />
                {t('lowCode.policies.newPolicy')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>{t('lowCode.policies.newPolicy')}</DialogTitle>
              </DialogHeader>
              <PolicyBuilderForm form={form} onChange={setForm} templates={templates} onApplyTemplate={applyTemplate} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t('lowCode.common.cancel')}</Button>
                <Button type="button" onClick={saveDraft} disabled={createMutation.isPending || updateMutation.isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  {t('lowCode.policies.saveDraft')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <BusinessMetric label={t('lowCode.policies.metrics.total')} value={summaryLoading ? '-' : summary?.totalRevisions ?? 0} />
        <BusinessMetric label={t('lowCode.policies.metrics.applied')} value={summary?.byStatus?.APPLIED ?? 0} tone="success" />
        <BusinessMetric label={t('lowCode.policies.metrics.draft')} value={summary?.byStatus?.DRAFT ?? 0} />
        <BusinessMetric label={t('lowCode.policies.metrics.blocked')} value={summary?.byStatus?.REJECTED ?? 0} tone="warning" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <Card>
          <CardHeader>
            <SectionHeading title={t('lowCode.policies.revisions')} />
          </CardHeader>
          <CardContent>
            {isError ? (
              <ErrorState title={t('lowCode.policies.loadFailed')} error={error} onRetry={() => refetch()} />
            ) : revisions.length === 0 && !isLoading ? (
              <EmptyState title={t('lowCode.policies.emptyTitle')} description={t('lowCode.policies.emptyDescription')} />
            ) : (
              <DataTable
                columns={columns}
                data={revisions}
                emptyMessage={t('lowCode.policies.emptyTitle')}
                isLoading={isLoading}
                keyExtractor={(row) => row.id}
                listKey="admin.policy-builder"
                total={revisions.length}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('lowCode.policies.lifecycle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedRevision ? (
              <>
                <div>
                  <p className="text-sm font-semibold">{selectedRevision.title}</p>
                  <p className="text-sm text-muted-foreground">{selectedRevision.area.replace(/_/g, ' ')} · {listSummary(selectedRevision.scope, scopeLabels)}</p>
                </div>
                <Badge variant={statusVariant(selectedRevision.status)}>{selectedRevision.status}</Badge>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" onClick={() => lifecycle('validate')}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {t('lowCode.policies.validate')}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => lifecycle('simulate')}>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    {t('lowCode.policies.simulate')}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => lifecycle('submit-review')}>{t('lowCode.policies.submit')}</Button>
                  <Button type="button" variant="outline" onClick={() => lifecycle('mark-reviewed')}>{t('lowCode.policies.markReviewed')}</Button>
                  <Button type="button" variant="outline" onClick={() => lifecycle('approve')}>{t('lowCode.policies.approve')}</Button>
                  <Button type="button" variant="outline" onClick={() => lifecycle('publish')}>{t('lowCode.policies.publish')}</Button>
                  <Button className="col-span-2" type="button" onClick={() => lifecycle('apply', { confirmedHighRisk: true })}>
                    {t('lowCode.policies.apply')}
                  </Button>
                </div>
                <PolicyPreview revision={selectedRevision} />
              </>
            ) : (
              <EmptyState icon={AlertTriangle} title={t('lowCode.policies.noSelection')} description={t('lowCode.policies.noSelectionDescription')} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PolicyBuilderForm({
  form,
  onChange,
  templates,
  onApplyTemplate,
}: {
  form: BuilderForm;
  onChange: React.Dispatch<React.SetStateAction<BuilderForm>>;
  templates: PolicyTemplate[];
  onApplyTemplate: (template: PolicyTemplate) => void;
}) {
  const { t } = useTranslation();
  const ruleLedgerSupported = isRuleLedgerSupportedArea(form.area);
  const categories = React.useMemo(() => getRuleLedgerCategories(form.area), [form.area]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>{t('lowCode.policies.form.template')}</Label>
          <Select onValueChange={(code) => {
            const template = templates.find((item) => item.code === code);
            if (template) onApplyTemplate(template);
          }}>
            <SelectTrigger><SelectValue placeholder={t('lowCode.policies.form.templatePlaceholder')} /></SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.code} value={template.code}>{template.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>{t('lowCode.policies.form.area')}</Label>
          <Select value={form.area} onValueChange={(area) => onChange((current) => ({
            ...current,
            area: area as PolicyArea,
            // A structured base and rule rows only make sense for the area they
            // were built for; switching areas starts the rule ledger fresh.
            baseDraftConfig: {},
            rules: [createRuleRow(area as PolicyArea)],
          }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {policyAreas.map((area) => <SelectItem key={area} value={area}>{area.replace(/_/g, ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label>{t('lowCode.policies.form.title')}</Label>
          <Input value={form.title} onChange={(event) => onChange((current) => ({ ...current, title: event.target.value }))} />
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-2">
        {[
          ['countries', 'countries'],
          ['legalEntities', 'legalEntities'],
          ['orgUnits', 'orgUnits'],
          ['departments', 'departments'],
          ['jobs', 'jobs'],
          ['grades', 'grades'],
          ['locations', 'locations'],
          ['employeeTypes', 'employeeTypes'],
          ['workers', 'workers'],
        ].map(([field, label]) => (
          <div key={field} className="grid gap-2">
            <Label>{t(`lowCode.policies.form.${label}`)}</Label>
            <Input
              value={form[field as keyof BuilderForm] as string}
              onChange={(event) => onChange((current) => ({ ...current, [field]: event.target.value }))}
              placeholder={t('lowCode.policies.form.listPlaceholder')}
            />
          </div>
        ))}
        <div className="grid gap-2">
          <Label>{t('lowCode.policies.form.effectiveFrom')}</Label>
          <Input type="date" value={form.effectiveFrom} onChange={(event) => onChange((current) => ({ ...current, effectiveFrom: event.target.value }))} />
        </div>
        <div className="grid gap-2">
          <Label>{t('lowCode.policies.form.effectiveUntil')}</Label>
          <Input type="date" value={form.effectiveUntil} onChange={(event) => onChange((current) => ({ ...current, effectiveUntil: event.target.value }))} />
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading title={t('lowCode.policies.form.rules')} />
        {ruleLedgerSupported ? (
          <RuleLedgerBuilder form={form} onChange={onChange} categories={categories} />
        ) : (
          <EmptyState
            icon={AlertTriangle}
            title={t('lowCode.policies.form.unsupportedRuleBuilderTitle')}
            description={t('lowCode.policies.form.unsupportedRuleBuilderMessage')}
          />
        )}
      </section>
    </div>
  );
}

function RuleLedgerBuilder({
  form,
  onChange,
  categories,
}: {
  form: BuilderForm;
  onChange: React.Dispatch<React.SetStateAction<BuilderForm>>;
  categories: { key: string; label: string }[];
}) {
  const { t } = useTranslation();
  const updateRule = (index: number, patch: Partial<RuleRow>) => {
    onChange((current) => ({
      ...current,
      rules: current.rules.map((rule, currentIndex) => (currentIndex === index ? { ...rule, ...patch } : rule)),
    }));
  };

  return (
    <div className="space-y-3">
      {form.area === 'LEAVE' && (
        <div className="grid gap-2 md:max-w-xs">
          <Label>{t('lowCode.policies.form.leavePolicyCode')}</Label>
          <Input
            value={form.leavePolicyCode}
            onChange={(event) => onChange((current) => ({ ...current, leavePolicyCode: event.target.value.toUpperCase() }))}
            placeholder={DEFAULT_GENERIC_LEAVE_POLICY_CODE}
          />
        </div>
      )}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange((current) => ({ ...current, rules: [...current.rules, createRuleRow(current.area, `RULE_${current.rules.length + 1}`)] }))}
        >
          {t('lowCode.policies.form.addRule')}
        </Button>
      </div>
      {form.rules.map((rule, index) => (
        <div key={`${rule.code}-${index}`} className="grid gap-3 rounded-xl border p-3 md:grid-cols-3">
          <Input aria-label={t('lowCode.policies.form.ruleCode')} placeholder={t('lowCode.policies.form.ruleCode')} value={rule.code} onChange={(event) => updateRule(index, { code: event.target.value })} />
          <Select value={rule.category} onValueChange={(category) => updateRule(index, { category })}>
            <SelectTrigger aria-label={t('lowCode.policies.form.category')}><SelectValue placeholder={t('lowCode.policies.form.category')} /></SelectTrigger>
            <SelectContent>
              {categories.map((category) => <SelectItem key={category.key} value={category.key}>{category.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={rule.retroBehavior} onValueChange={(retroBehavior) => updateRule(index, { retroBehavior: retroBehavior as RuleLedgerRetroBehavior })}>
            <SelectTrigger aria-label={t('lowCode.policies.form.retroBehavior')}><SelectValue placeholder={t('lowCode.policies.form.retroBehavior')} /></SelectTrigger>
            <SelectContent>
              {RULE_LEDGER_RETRO_BEHAVIORS.map((behavior) => <SelectItem key={behavior} value={behavior}>{behavior.replace(/_/g, ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input aria-label={t('lowCode.policies.form.condition')} placeholder={t('lowCode.policies.form.condition')} value={rule.condition} onChange={(event) => updateRule(index, { condition: event.target.value })} />
          <Input aria-label={t('lowCode.policies.form.outcome')} placeholder={t('lowCode.policies.form.outcome')} value={rule.outcome} onChange={(event) => updateRule(index, { outcome: event.target.value })} />
          <Input aria-label={t('lowCode.policies.form.value')} placeholder={t('lowCode.policies.form.value')} value={rule.value} onChange={(event) => updateRule(index, { value: event.target.value })} />
        </div>
      ))}
    </div>
  );
}

function PolicyPreview({ revision }: { revision: PolicyRevision }) {
  const { t } = useTranslation();
  const validation = revision.validationResult;
  const simulation = revision.simulationResult;
  return (
    <div className="space-y-3 rounded-xl bg-muted/30 p-3 text-sm">
      <div>
        <p className="font-semibold">{t('lowCode.policies.validation')}</p>
        <p className={validation?.valid ? 'text-emerald-700' : 'text-amber-700'}>
          {validation ? (validation.valid ? t('lowCode.policies.valid') : validation.errors.join(', ')) : t('lowCode.policies.notRun')}
        </p>
      </div>
      <div>
        <p className="font-semibold">{t('lowCode.policies.simulation')}</p>
        <p>{simulation ? `${simulation.impactedEmployees} ${t('lowCode.policies.people')} · ${simulation.notificationPreview?.totalRecipients ?? 0} ${t('lowCode.policies.recipients')}` : t('lowCode.policies.notRun')}</p>
      </div>
    </div>
  );
}
