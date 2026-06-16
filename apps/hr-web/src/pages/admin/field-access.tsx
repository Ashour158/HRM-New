import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit3, EyeOff, Plus } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useApiQuery } from '@/hooks/use-api';
import { useTenant } from '@/hooks/use-tenant';
import { useUIStore } from '@/stores/ui-store';
import { BusinessPageHeader } from '@/components/common/business-page';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type FieldAccessPolicy = {
  id: string;
  fieldPath: string;
  dataClassification: string;
  roleDecisions: unknown;
  selfServiceDecision: string | null;
  managerDecision: string | null;
  maskingRule: string | null;
  createdAt: string;
};

type AccessGovernanceSummary = {
  fieldAccessPolicies: FieldAccessPolicy[];
};

type FieldAccessForm = {
  fieldPath: string;
  dataClassification: string;
  roleCode: string;
  roleDecision: string;
  selfServiceDecision: string;
  managerDecision: string;
  maskingRule: string;
};

const initialForm: FieldAccessForm = {
  fieldPath: 'worker.compensation.salary',
  dataClassification: 'HIGH_SENSITIVITY',
  roleCode: 'HR_ADMIN',
  roleDecision: 'VISIBLE',
  selfServiceDecision: 'HIDDEN',
  managerDecision: 'MASKED',
  maskingRule: 'SHOW_RANGE',
};

const decisions = ['VISIBLE', 'MASKED', 'HIDDEN', 'REQUIRES_STEP_UP', 'REQUIRES_BREAK_GLASS'];
const classifications = ['LOW', 'CONFIDENTIAL', 'HIGH_SENSITIVITY', 'SPECIAL_CATEGORY', 'LEGAL_HOLD'];
const maskingRules = ['SHOW_LAST_4', 'SHOW_RANGE', 'SHOW_INITIALS', 'REDACT_VALUE', 'GENERALIZE_LOCATION'];

function roleDecisionLabel(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '-';
  return Object.entries(value as Record<string, unknown>).map(([role, decision]) => `${role}: ${String(decision)}`).join(', ');
}

function formFromPolicy(policy: FieldAccessPolicy): FieldAccessForm {
  const roleDecisions = (policy.roleDecisions && typeof policy.roleDecisions === 'object' && !Array.isArray(policy.roleDecisions))
    ? policy.roleDecisions as Record<string, unknown>
    : {};
  const [roleCode, roleDecision] = Object.entries(roleDecisions)[0] ?? ['HR_ADMIN', 'VISIBLE'];
  return {
    fieldPath: policy.fieldPath,
    dataClassification: policy.dataClassification,
    roleCode,
    roleDecision: String(roleDecision),
    selfServiceDecision: policy.selfServiceDecision ?? 'HIDDEN',
    managerDecision: policy.managerDecision ?? 'MASKED',
    maskingRule: policy.maskingRule ?? 'SHOW_RANGE',
  };
}

function payloadFromForm(form: FieldAccessForm) {
  return {
    fieldPath: form.fieldPath,
    dataClassification: form.dataClassification,
    roleDecisions: form.roleCode ? { [form.roleCode]: form.roleDecision } : {},
    selfServiceDecision: form.selfServiceDecision,
    managerDecision: form.managerDecision,
    maskingRule: form.maskingRule,
  };
}

export function AdminFieldAccess() {
  const { t } = useTranslation();
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);
  const [form, setForm] = React.useState<FieldAccessForm>(initialForm);
  const [editing, setEditing] = React.useState<FieldAccessPolicy | null>(null);
  const [open, setOpen] = React.useState(false);

  const { data, isLoading, isError, error, refetch } = useApiQuery<AccessGovernanceSummary>(
    ['access-governance', tenantId],
    '/admin/access-governance',
    { enabled: Boolean(tenantId), retry: false },
  );

  const policies = React.useMemo(() => data?.fieldAccessPolicies ?? [], [data?.fieldAccessPolicies]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = payloadFromForm(form);
      const response = editing
        ? await apiClient.patch<{ data: FieldAccessPolicy }>(`/admin/access-governance/field-access-policies/${editing.id}`, payload)
        : await apiClient.post<{ data: FieldAccessPolicy }>('/admin/access-governance/field-access-policies', payload);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-governance', tenantId] });
      setOpen(false);
      setEditing(null);
      setForm(initialForm);
      addNotification({ title: t('lowCode.fieldAccess.savedTitle'), message: t('lowCode.fieldAccess.savedMessage'), type: 'success', read: false });
    },
    onError: (mutationError) => {
      addNotification({
        title: t('lowCode.fieldAccess.saveFailedTitle'),
        message: mutationError instanceof Error ? mutationError.message : t('lowCode.fieldAccess.saveFailedMessage'),
        type: 'error',
        read: false,
      });
    },
  });

  const startEdit = (policy: FieldAccessPolicy) => {
    setEditing(policy);
    setForm(formFromPolicy(policy));
    setOpen(true);
  };

  const columns = React.useMemo<DataTableColumn<FieldAccessPolicy>[]>(() => [
    { key: 'field', header: t('lowCode.fieldAccess.table.field'), cell: (row) => <span className="font-mono text-xs">{row.fieldPath}</span> },
    { key: 'classification', header: t('lowCode.fieldAccess.table.classification'), cell: (row) => <Badge variant="outline">{row.dataClassification}</Badge> },
    { key: 'roles', header: t('lowCode.fieldAccess.table.roles'), cell: (row) => roleDecisionLabel(row.roleDecisions) },
    { key: 'self', header: t('lowCode.fieldAccess.table.self'), cell: (row) => row.selfServiceDecision ?? '-' },
    { key: 'manager', header: t('lowCode.fieldAccess.table.manager'), cell: (row) => row.managerDecision ?? '-' },
    { key: 'masking', header: t('lowCode.fieldAccess.table.masking'), cell: (row) => row.maskingRule ?? '-' },
    {
      key: 'actions',
      header: t('lowCode.common.actions'),
      cell: (row) => (
        <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(row)}>
          <Edit3 className="mr-2 h-4 w-4" />
          {t('lowCode.common.edit')}
        </Button>
      ),
    },
  ], [t]);

  return (
    <div className="space-y-6 p-6">
      <BusinessPageHeader
        eyebrow={t('lowCode.fieldAccess.eyebrow')}
        icon={EyeOff}
        title={t('lowCode.fieldAccess.title')}
        subtitle={t('lowCode.fieldAccess.subtitle')}
        actions={(
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button type="button" onClick={() => { setEditing(null); setForm(initialForm); }}>
                <Plus className="mr-2 h-4 w-4" />
                {t('lowCode.fieldAccess.addPolicy')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editing ? t('lowCode.fieldAccess.editPolicy') : t('lowCode.fieldAccess.addPolicy')}</DialogTitle>
              </DialogHeader>
              <FieldAccessFormFields form={form} onChange={setForm} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t('lowCode.common.cancel')}</Button>
                <Button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.fieldPath}>
                  {t('lowCode.common.save')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      />

      <Card>
        <CardContent className="pt-6">
          {isError ? (
            <ErrorState title={t('lowCode.fieldAccess.loadFailed')} error={error} onRetry={() => refetch()} />
          ) : policies.length === 0 && !isLoading ? (
            <EmptyState title={t('lowCode.fieldAccess.emptyTitle')} description={t('lowCode.fieldAccess.emptyDescription')} />
          ) : (
            <DataTable
              columns={columns}
              data={policies}
              emptyMessage={t('lowCode.fieldAccess.emptyTitle')}
              isLoading={isLoading}
              keyExtractor={(row) => row.id}
              listKey="admin.field-access"
              total={policies.length}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FieldAccessFormFields({ form, onChange }: { form: FieldAccessForm; onChange: React.Dispatch<React.SetStateAction<FieldAccessForm>> }) {
  const { t } = useTranslation();
  const set = (patch: Partial<FieldAccessForm>) => onChange((current) => ({ ...current, ...patch }));
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label>{t('lowCode.fieldAccess.form.fieldPath')}</Label>
        <Input value={form.fieldPath} onChange={(event) => set({ fieldPath: event.target.value })} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>{t('lowCode.fieldAccess.form.classification')}</Label>
          <Select value={form.dataClassification} onValueChange={(value) => set({ dataClassification: value })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {classifications.map((classification) => <SelectItem key={classification} value={classification}>{classification}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>{t('lowCode.fieldAccess.form.maskingRule')}</Label>
          <Select value={form.maskingRule} onValueChange={(value) => set({ maskingRule: value })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {maskingRules.map((rule) => <SelectItem key={rule} value={rule}>{rule}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>{t('lowCode.fieldAccess.form.role')}</Label>
          <Input value={form.roleCode} onChange={(event) => set({ roleCode: event.target.value })} />
        </div>
        <DecisionSelect label={t('lowCode.fieldAccess.form.roleDecision')} value={form.roleDecision} onChange={(value) => set({ roleDecision: value })} />
        <DecisionSelect label={t('lowCode.fieldAccess.form.selfDecision')} value={form.selfServiceDecision} onChange={(value) => set({ selfServiceDecision: value })} />
        <DecisionSelect label={t('lowCode.fieldAccess.form.managerDecision')} value={form.managerDecision} onChange={(value) => set({ managerDecision: value })} />
      </div>
    </div>
  );
}

function DecisionSelect({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {decisions.map((decision) => <SelectItem key={decision} value={decision}>{decision}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
