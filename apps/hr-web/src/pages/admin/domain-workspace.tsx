import * as React from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useApiQuery } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { useTenant } from '@/hooks/use-tenant';
import { useUIStore } from '@/stores/ui-store';
import { AllowedActions } from '@/components/common/allowed-actions';
import { BusinessPageHeader } from '@/components/common/business-page';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AllowedAction } from '@/types';

export type DomainRecord = Record<string, unknown>;

type FieldType = 'text' | 'number' | 'date' | 'textarea' | 'csv';

export interface DomainFormField {
  key: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  parse?: (value: string) => unknown;
}

interface CommandMapping {
  tokens: string[];
  command: string;
  payload?: (record: DomainRecord, actorId: string) => Record<string, unknown>;
}

export interface DomainEntityConfig {
  key: string;
  label: string;
  aggregateType: string;
  listPath: (tenantId: string) => string;
  createPath: string;
  createLabel: string;
  titleField: string;
  secondaryField?: string;
  fields: DomainFormField[];
  commandBasePath: (recordId: string) => string;
  commandMappings: CommandMapping[];
}

export interface DomainWorkspaceConfig {
  title: string;
  eyebrow: string;
  subtitle: string;
  entities: DomainEntityConfig[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

function idValue(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'value' in value) {
    const maybeValue = (value as { value?: unknown }).value;
    return typeof maybeValue === 'string' ? maybeValue : '';
  }
  return String(value);
}

function recordId(record: DomainRecord): string {
  return idValue(record.id);
}

function recordText(record: DomainRecord, key: string): string {
  const value = record[key];
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return `${value.length}`;
  if (typeof value === 'object') return idValue(value) || JSON.stringify(value);
  return String(value);
}

function humanizeField(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function detailRows(record: DomainRecord, entity: DomainEntityConfig) {
  const preferredKeys = [
    ...entity.fields.map((field) => field.key),
    entity.secondaryField,
    'status',
    'createdAt',
    'updatedAt',
  ].filter((key): key is string => Boolean(key));
  const seen = new Set<string>();
  const keys = [
    ...preferredKeys,
    ...Object.keys(record).filter((key) => !['id', entity.titleField].includes(key)),
  ].filter((key) => {
    if (seen.has(key)) return false;
    seen.add(key);
    const value = record[key];
    return value !== undefined && value !== null && value !== '';
  });

  return keys.slice(0, 16).map((key) => ({
    key,
    label: entity.fields.find((field) => field.key === key)?.label ?? humanizeField(key),
    value: recordText(record, key) || '-',
  }));
}

function statusBadge(status: unknown) {
  const value = String(status ?? 'DRAFT');
  const normalized = value.toUpperCase();
  const tone = normalized.includes('ACTIVE') || normalized.includes('APPROVED') || normalized.includes('COMPLETED')
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : normalized.includes('REJECT') || normalized.includes('FAILED') || normalized.includes('EXPIRED')
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : normalized.includes('PENDING') || normalized.includes('REVIEW') || normalized.includes('DRAFT')
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-slate-200 bg-slate-50 text-slate-700';
  return <Badge variant="outline" className={tone}>{value}</Badge>;
}

function splitCsv(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function initialForm(fields: DomainFormField[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field.key, field.defaultValue ?? '']));
}

function payloadFromForm(fields: DomainFormField[], form: Record<string, string>): DomainRecord {
  return fields.reduce<DomainRecord>((payload, field) => {
    const rawValue = form[field.key]?.trim() ?? '';
    if (!rawValue && !field.required) return payload;
    if (field.parse) {
      payload[field.key] = field.parse(rawValue);
    } else if (field.type === 'number') {
      payload[field.key] = Number(rawValue);
    } else if (field.type === 'csv') {
      payload[field.key] = splitCsv(rawValue);
    } else {
      payload[field.key] = rawValue;
    }
    return payload;
  }, {});
}

function actionToken(action: AllowedAction): string {
  return `${action.action} ${action.id} ${action.label}`.toLowerCase();
}

function commandForAction(action: AllowedAction, mappings: CommandMapping[]): CommandMapping | undefined {
  const token = actionToken(action);
  return mappings.find((mapping) => mapping.tokens.some((candidate) => token.includes(candidate.toLowerCase())));
}

function DomainEntityPanel({ entity }: { entity: DomainEntityConfig }) {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const actorId = user?.id ?? '';
  const addNotification = useUIStore((state) => state.addNotification);
  const queryClient = useQueryClient();
  const queryKey = React.useMemo(() => ['admin-domain-workspace', entity.key, tenantId], [entity.key, tenantId]);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState(() => initialForm(entity.fields));
  const [selectedId, setSelectedId] = React.useState('');

  const recordsQuery = useApiQuery<DomainRecord[]>(
    queryKey,
    tenantId ? entity.listPath(tenantId) : '',
    { enabled: Boolean(tenantId) },
  );
  const records = React.useMemo(() => recordsQuery.data ?? [], [recordsQuery.data]);

  React.useEffect(() => {
    if (records.length === 0) {
      setSelectedId('');
      return;
    }
    const stillExists = records.some((record) => recordId(record) === selectedId);
    if (!stillExists) setSelectedId(recordId(records[0]));
  }, [records, selectedId]);

  const selectedRecord = records.find((record) => recordId(record) === selectedId) ?? records[0];

  const createMutation = useMutation({
    mutationFn: async (payload: DomainRecord) => {
      const response = await apiClient.post<ApiResponse<unknown>>(entity.createPath, payload);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setCreateOpen(false);
      setForm(initialForm(entity.fields));
      addNotification({ title: `${entity.label} created`, message: 'The record is now available in this workspace.', type: 'success', read: false });
    },
    onError: (error: Error) => {
      addNotification({ title: `Could not create ${entity.label.toLowerCase()}`, message: error.message, type: 'error', read: false });
    },
  });

  const commandMutation = useMutation({
    mutationFn: async ({ record, mapping }: { record: DomainRecord; mapping: CommandMapping }) => {
      const body = mapping.payload?.(record, actorId) ?? {};
      const response = await apiClient.post<ApiResponse<unknown>>(`${entity.commandBasePath(recordId(record))}/${mapping.command}`, body);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['allowed-actions'] });
      addNotification({ title: `${entity.label} updated`, message: 'The lifecycle action was applied.', type: 'success', read: false });
    },
    onError: (error: Error) => {
      addNotification({ title: `Could not update ${entity.label.toLowerCase()}`, message: error.message, type: 'error', read: false });
    },
  });

  const columns = React.useMemo<DataTableColumn<DomainRecord>[]>(() => [
    {
      key: 'name',
      header: entity.label,
      cell: (record) => (
        <button
          type="button"
          className="text-left font-semibold text-indigo-700 hover:underline"
          onClick={() => setSelectedId(recordId(record))}
        >
          {recordText(record, entity.titleField) || recordId(record)}
        </button>
      ),
    },
    {
      key: 'secondary',
      header: entity.secondaryField ? entity.secondaryField.replace(/([A-Z])/g, ' $1') : 'Reference',
      cell: (record) => entity.secondaryField ? recordText(record, entity.secondaryField) || '-' : recordId(record),
    },
    { key: 'status', header: 'Status', cell: (record) => statusBadge(record.status) },
  ], [entity.label, entity.secondaryField, entity.titleField]);

  const submitCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createMutation.mutate(payloadFromForm(entity.fields, form));
  };

  const runAllowedAction = (action: AllowedAction) => {
    if (!selectedRecord) return;
    const mapping = commandForAction(action, entity.commandMappings);
    if (!mapping) {
      addNotification({
        title: 'More information needed',
        message: 'Open the record detail screen for actions that require extra business data.',
        type: 'warning',
        read: false,
      });
      return;
    }
    commandMutation.mutate({ record: selectedRecord, mapping });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-xl">{entity.label}</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2 rounded-xl" onClick={() => recordsQuery.refetch()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button className="gap-2 rounded-xl" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              {entity.createLabel}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recordsQuery.isError ? (
            <ErrorState title={`Unable to load ${entity.label.toLowerCase()}`} error={recordsQuery.error} onRetry={() => recordsQuery.refetch()} />
          ) : records.length === 0 && !recordsQuery.isLoading ? (
            <EmptyState title={`No ${entity.label.toLowerCase()} yet`} action={{ label: entity.createLabel, onClick: () => setCreateOpen(true) }} />
          ) : (
            <DataTable
              columns={columns}
              data={records}
              keyExtractor={recordId}
              isLoading={recordsQuery.isLoading}
              emptyMessage={`No ${entity.label.toLowerCase()} yet`}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Record controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedRecord ? (
            <EmptyState title="Select a record" description="Lifecycle controls appear here." />
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">{recordText(selectedRecord, entity.titleField) || recordId(selectedRecord)}</p>
                <p className="text-xs text-slate-500">{recordId(selectedRecord)}</p>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/60 p-3">
                <span className="text-sm font-semibold text-slate-600">Status</span>
                {statusBadge(selectedRecord.status)}
              </div>
              <div className="max-h-[26rem] space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                {detailRows(selectedRecord, entity).map((row) => (
                  <div key={row.key} className="grid gap-1 border-b border-slate-200/70 pb-2 last:border-b-0 last:pb-0">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{row.label}</span>
                    <span className="break-words text-sm text-slate-900">{row.value}</span>
                  </div>
                ))}
              </div>
              <AllowedActions
                aggregateType={entity.aggregateType}
                aggregateId={recordId(selectedRecord)}
                state={recordText(selectedRecord, 'status')}
                onAction={runAllowedAction}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{entity.createLabel}</DialogTitle>
            <DialogDescription>Fill the business fields required to create this record.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitCreate}>
            <div className="grid gap-4 md:grid-cols-2">
              {entity.fields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={`${entity.key}-${field.key}`}>{field.label}</Label>
                  {field.type === 'textarea' ? (
                    <textarea
                      id={`${entity.key}-${field.key}`}
                      className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={form[field.key] ?? ''}
                      required={field.required}
                      placeholder={field.placeholder}
                      onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                    />
                  ) : (
                    <Input
                      id={`${entity.key}-${field.key}`}
                      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                      value={form[field.key] ?? ''}
                      required={field.required}
                      placeholder={field.placeholder}
                      onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating...' : entity.createLabel}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AdminDomainWorkspace({ config }: { config: DomainWorkspaceConfig }) {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
      <BusinessPageHeader
        eyebrow={config.eyebrow}
        title={config.title}
        subtitle={config.subtitle}
      />
      <Tabs defaultValue={config.entities[0]?.key} className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          {config.entities.map((entity) => (
            <TabsTrigger key={entity.key} value={entity.key}>{entity.label}</TabsTrigger>
          ))}
        </TabsList>
        {config.entities.map((entity) => (
          <TabsContent key={entity.key} value={entity.key}>
            <DomainEntityPanel entity={entity} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
