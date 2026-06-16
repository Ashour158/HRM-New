import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit3, Plus, ShieldAlert } from 'lucide-react';
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

type SodRule = {
  id: string;
  code: string;
  description: string | null;
  incompatibleRolePairs: unknown | null;
  incompatiblePermissionPairs: unknown | null;
  enforcementPoint: string | null;
  breakGlassAllowed: boolean;
  createdAt: string;
};

type AccessGovernanceSummary = {
  sodRules: SodRule[];
};

type SodForm = {
  code: string;
  description: string;
  roleA: string;
  roleB: string;
  permissionA: string;
  permissionB: string;
  enforcementPoint: string;
  breakGlassAllowed: string;
};

const initialForm: SodForm = {
  code: '',
  description: '',
  roleA: '',
  roleB: '',
  permissionA: '',
  permissionB: '',
  enforcementPoint: 'ROLE_ASSIGNMENT',
  breakGlassAllowed: 'false',
};

function pairLabel(value: unknown): string {
  if (!Array.isArray(value)) return '-';
  return value
    .filter((pair): pair is [string, string] => Array.isArray(pair) && typeof pair[0] === 'string' && typeof pair[1] === 'string')
    .map(([left, right]) => `${left} ↔ ${right}`)
    .join(', ') || '-';
}

function formFromRule(rule: SodRule): SodForm {
  const rolePair = Array.isArray(rule.incompatibleRolePairs) && Array.isArray(rule.incompatibleRolePairs[0])
    ? rule.incompatibleRolePairs[0] as [string, string]
    : ['', ''];
  const permissionPair = Array.isArray(rule.incompatiblePermissionPairs) && Array.isArray(rule.incompatiblePermissionPairs[0])
    ? rule.incompatiblePermissionPairs[0] as [string, string]
    : ['', ''];
  return {
    code: rule.code,
    description: rule.description ?? '',
    roleA: rolePair[0] ?? '',
    roleB: rolePair[1] ?? '',
    permissionA: permissionPair[0] ?? '',
    permissionB: permissionPair[1] ?? '',
    enforcementPoint: rule.enforcementPoint ?? 'ROLE_ASSIGNMENT',
    breakGlassAllowed: String(rule.breakGlassAllowed),
  };
}

function payloadFromForm(form: SodForm) {
  const rolePairs = form.roleA && form.roleB ? [[form.roleA.trim(), form.roleB.trim()]] : [];
  const permissionPairs = form.permissionA && form.permissionB ? [[form.permissionA.trim(), form.permissionB.trim()]] : [];
  return {
    code: form.code,
    description: form.description || null,
    incompatibleRolePairs: rolePairs,
    incompatiblePermissionPairs: permissionPairs,
    enforcementPoint: form.enforcementPoint,
    breakGlassAllowed: form.breakGlassAllowed === 'true',
  };
}

export function AdminSodRules() {
  const { t } = useTranslation();
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);
  const [form, setForm] = React.useState<SodForm>(initialForm);
  const [editing, setEditing] = React.useState<SodRule | null>(null);
  const [open, setOpen] = React.useState(false);

  const { data, isLoading, isError, error, refetch } = useApiQuery<AccessGovernanceSummary>(
    ['access-governance', tenantId],
    '/admin/access-governance',
    { enabled: Boolean(tenantId), retry: false },
  );

  const rules = React.useMemo(() => data?.sodRules ?? [], [data?.sodRules]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = payloadFromForm(form);
      const response = editing
        ? await apiClient.patch<{ data: SodRule }>(`/admin/access-governance/sod-rules/${editing.id}`, payload)
        : await apiClient.post<{ data: SodRule }>('/admin/access-governance/sod-rules', payload);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-governance', tenantId] });
      setOpen(false);
      setEditing(null);
      setForm(initialForm);
      addNotification({ title: t('lowCode.sod.savedTitle'), message: t('lowCode.sod.savedMessage'), type: 'success', read: false });
    },
    onError: (mutationError) => {
      addNotification({
        title: t('lowCode.sod.saveFailedTitle'),
        message: mutationError instanceof Error ? mutationError.message : t('lowCode.sod.saveFailedMessage'),
        type: 'error',
        read: false,
      });
    },
  });

  const startEdit = (rule: SodRule) => {
    setEditing(rule);
    setForm(formFromRule(rule));
    setOpen(true);
  };

  const columns = React.useMemo<DataTableColumn<SodRule>[]>(() => [
    { key: 'code', header: t('lowCode.sod.table.code'), cell: (row) => <span className="font-mono text-xs">{row.code}</span> },
    { key: 'description', header: t('lowCode.sod.table.description'), cell: (row) => row.description ?? '-' },
    { key: 'roles', header: t('lowCode.sod.table.roles'), cell: (row) => pairLabel(row.incompatibleRolePairs) },
    { key: 'permissions', header: t('lowCode.sod.table.permissions'), cell: (row) => pairLabel(row.incompatiblePermissionPairs) },
    { key: 'breakGlass', header: t('lowCode.sod.table.breakGlass'), cell: (row) => <Badge variant={row.breakGlassAllowed ? 'secondary' : 'outline'}>{row.breakGlassAllowed ? t('lowCode.common.allowed') : t('lowCode.common.blocked')}</Badge> },
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
        eyebrow={t('lowCode.sod.eyebrow')}
        icon={ShieldAlert}
        title={t('lowCode.sod.title')}
        subtitle={t('lowCode.sod.subtitle')}
        actions={(
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button type="button" onClick={() => { setEditing(null); setForm(initialForm); }}>
                <Plus className="mr-2 h-4 w-4" />
                {t('lowCode.sod.addRule')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editing ? t('lowCode.sod.editRule') : t('lowCode.sod.addRule')}</DialogTitle>
              </DialogHeader>
              <SodRuleForm form={form} onChange={setForm} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t('lowCode.common.cancel')}</Button>
                <Button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.code}>
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
            <ErrorState title={t('lowCode.sod.loadFailed')} error={error} onRetry={() => refetch()} />
          ) : rules.length === 0 && !isLoading ? (
            <EmptyState title={t('lowCode.sod.emptyTitle')} description={t('lowCode.sod.emptyDescription')} />
          ) : (
            <DataTable
              columns={columns}
              data={rules}
              emptyMessage={t('lowCode.sod.emptyTitle')}
              isLoading={isLoading}
              keyExtractor={(row) => row.id}
              listKey="admin.sod-rules"
              total={rules.length}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SodRuleForm({ form, onChange }: { form: SodForm; onChange: React.Dispatch<React.SetStateAction<SodForm>> }) {
  const { t } = useTranslation();
  const set = (patch: Partial<SodForm>) => onChange((current) => ({ ...current, ...patch }));
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label>{t('lowCode.sod.form.code')}</Label>
        <Input value={form.code} onChange={(event) => set({ code: event.target.value })} />
      </div>
      <div className="grid gap-2">
        <Label>{t('lowCode.sod.form.description')}</Label>
        <Input value={form.description} onChange={(event) => set({ description: event.target.value })} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>{t('lowCode.sod.form.roleA')}</Label>
          <Input value={form.roleA} onChange={(event) => set({ roleA: event.target.value })} />
        </div>
        <div className="grid gap-2">
          <Label>{t('lowCode.sod.form.roleB')}</Label>
          <Input value={form.roleB} onChange={(event) => set({ roleB: event.target.value })} />
        </div>
        <div className="grid gap-2">
          <Label>{t('lowCode.sod.form.permissionA')}</Label>
          <Input value={form.permissionA} onChange={(event) => set({ permissionA: event.target.value })} />
        </div>
        <div className="grid gap-2">
          <Label>{t('lowCode.sod.form.permissionB')}</Label>
          <Input value={form.permissionB} onChange={(event) => set({ permissionB: event.target.value })} />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>{t('lowCode.sod.form.enforcementPoint')}</Label>
          <Input value={form.enforcementPoint} onChange={(event) => set({ enforcementPoint: event.target.value })} />
        </div>
        <div className="grid gap-2">
          <Label>{t('lowCode.sod.form.breakGlass')}</Label>
          <Select value={form.breakGlassAllowed} onValueChange={(value) => set({ breakGlassAllowed: value })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="false">{t('lowCode.common.blocked')}</SelectItem>
              <SelectItem value="true">{t('lowCode.common.allowed')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
