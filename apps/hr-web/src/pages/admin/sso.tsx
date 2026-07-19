import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound, LockKeyhole, Plus, RefreshCcw, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useTenant } from '@/hooks/use-tenant';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { BusinessPageHeader } from '@/components/common/business-page';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { FormField } from '@/components/common/form-field';
import { jsonObjectText, requiredText } from '@/components/forms/schema-helpers';
import { useUIStore } from '@/stores/ui-store';

type SsoProtocol = 'OIDC' | 'SAML';

interface SsoConfigRecord {
  id: string;
  tenantId: string;
  protocol: SsoProtocol;
  displayName: string;
  enabled: boolean;
  jitProvisioning: boolean;
  defaultRoles: string[];
  attributeMapping: Record<string, string>;
  groupRoleMapping: Record<string, string[]>;
  oidcIssuerUrl?: string;
  oidcClientId?: string;
  oidcScopes: string[];
  hasOidcClientSecret: boolean;
  samlIdpEntityId?: string;
  samlIdpSsoUrl?: string;
  samlIdpX509Cert?: string;
  hasSamlSpPrivateKey: boolean;
}

const ssoConfigSchema = z
  .object({
    id: z.string().optional(),
    protocol: z.enum(['OIDC', 'SAML']),
    displayName: requiredText('Display name is required'),
    enabled: z.boolean(),
    jitProvisioning: z.boolean(),
    defaultRoles: z.string(),
    attributeMapping: jsonObjectText('Attribute mapping must be a valid JSON object'),
    groupRoleMapping: jsonObjectText('Group role mapping must be a valid JSON object'),
    oidcIssuerUrl: z.string(),
    oidcClientId: z.string(),
    oidcClientSecret: z.string(),
    oidcScopes: z.string(),
    samlIdpEntityId: z.string(),
    samlIdpSsoUrl: z.string(),
    samlIdpX509Cert: z.string(),
    samlSpPrivateKey: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.protocol === 'OIDC') {
      if (!values.oidcIssuerUrl.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Issuer URL is required', path: ['oidcIssuerUrl'] });
      }
      if (!values.oidcClientId.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Client ID is required', path: ['oidcClientId'] });
      }
    } else {
      if (!values.samlIdpEntityId.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'IdP entity ID is required', path: ['samlIdpEntityId'] });
      }
      if (!values.samlIdpSsoUrl.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'IdP SSO URL is required', path: ['samlIdpSsoUrl'] });
      }
    }
  });

type SsoConfigForm = z.infer<typeof ssoConfigSchema>;

function emptyForm(protocol: SsoProtocol = 'OIDC'): SsoConfigForm {
  return {
    protocol,
    displayName: protocol === 'OIDC' ? 'Company OIDC' : 'Company SAML',
    enabled: false,
    jitProvisioning: true,
    defaultRoles: 'EMPLOYEE',
    attributeMapping: '{\n  "email": "email",\n  "firstName": "firstName",\n  "lastName": "lastName",\n  "groups": "groups"\n}',
    groupRoleMapping: '{}',
    oidcIssuerUrl: '',
    oidcClientId: '',
    oidcClientSecret: '',
    oidcScopes: 'openid,email,profile',
    samlIdpEntityId: '',
    samlIdpSsoUrl: '',
    samlIdpX509Cert: '',
    samlSpPrivateKey: '',
  };
}

function formFromRecord(record: SsoConfigRecord): SsoConfigForm {
  return {
    id: record.id,
    protocol: record.protocol,
    displayName: record.displayName,
    enabled: record.enabled,
    jitProvisioning: record.jitProvisioning,
    defaultRoles: record.defaultRoles.join(','),
    attributeMapping: JSON.stringify(record.attributeMapping ?? {}, null, 2),
    groupRoleMapping: JSON.stringify(record.groupRoleMapping ?? {}, null, 2),
    oidcIssuerUrl: record.oidcIssuerUrl ?? '',
    oidcClientId: record.oidcClientId ?? '',
    oidcClientSecret: '',
    oidcScopes: record.oidcScopes.join(','),
    samlIdpEntityId: record.samlIdpEntityId ?? '',
    samlIdpSsoUrl: record.samlIdpSsoUrl ?? '',
    samlIdpX509Cert: record.samlIdpX509Cert ?? '',
    samlSpPrivateKey: '',
  };
}

function parseJsonObject(value: string, fallback: Record<string, unknown>) {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const parsed = JSON.parse(trimmed) as unknown;
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : fallback;
}

function buildPayload(form: SsoConfigForm) {
  const payload: Record<string, unknown> = {
    protocol: form.protocol,
    displayName: form.displayName.trim(),
    enabled: form.enabled,
    jitProvisioning: form.jitProvisioning,
    defaultRoles: form.defaultRoles.split(',').map((role) => role.trim()).filter(Boolean),
    attributeMapping: parseJsonObject(form.attributeMapping, {}),
    groupRoleMapping: parseJsonObject(form.groupRoleMapping, {}),
  };

  if (form.protocol === 'OIDC') {
    payload.oidcIssuerUrl = form.oidcIssuerUrl.trim();
    payload.oidcClientId = form.oidcClientId.trim();
    payload.oidcScopes = form.oidcScopes.split(',').map((scope) => scope.trim()).filter(Boolean);
    if (form.oidcClientSecret.trim()) payload.oidcClientSecret = form.oidcClientSecret.trim();
  } else {
    payload.samlIdpEntityId = form.samlIdpEntityId.trim();
    payload.samlIdpSsoUrl = form.samlIdpSsoUrl.trim();
    payload.samlIdpX509Cert = form.samlIdpX509Cert.trim();
    if (form.samlSpPrivateKey.trim()) payload.samlSpPrivateKey = form.samlSpPrivateKey.trim();
  }

  return payload;
}

function unwrapApiData<T>(response: { data: unknown }): T {
  const envelope = response.data as { data?: T; success?: boolean };
  if (envelope && typeof envelope === 'object' && envelope.success === true && 'data' in envelope) {
    return envelope.data as T;
  }
  return response.data as T;
}

function mutationMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'The SSO configuration could not be saved.';
}

function statusLabel(record: SsoConfigRecord): string {
  return record.enabled ? 'Enabled' : 'Disabled';
}

export function AdminSso() {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((state) => state.addNotification);
  const { tenantId, tenantName } = useTenant();
  const form = useForm<SsoConfigForm>({
    resolver: zodResolver(ssoConfigSchema),
    defaultValues: emptyForm(),
  });
  const [didAutoSelect, setDidAutoSelect] = React.useState(false);

  const watchedProtocol = form.watch('protocol');
  const watchedId = form.watch('id');

  const queryKey = React.useMemo(() => ['sso-config', tenantId], [tenantId]);
  const configsQuery = useQuery({
    queryKey,
    enabled: Boolean(tenantId),
    queryFn: async () => unwrapApiData<SsoConfigRecord[]>(await apiClient.get('/auth/sso/config')),
  });

  const records = React.useMemo(() => configsQuery.data ?? [], [configsQuery.data]);

  React.useEffect(() => {
    setDidAutoSelect(false);
    form.reset(emptyForm());
  }, [tenantId, form]);

  React.useEffect(() => {
    if (!didAutoSelect && records.length > 0) {
      form.reset(formFromRecord(records[0]));
      setDidAutoSelect(true);
    }
  }, [didAutoSelect, records, form]);

  const saveConfig = useMutation({
    mutationFn: async (draft: SsoConfigForm) => {
      const payload = buildPayload(draft);
      if (draft.id) {
        return unwrapApiData<SsoConfigRecord>(await apiClient.patch(`/auth/sso/config/${draft.id}`, payload));
      }
      return unwrapApiData<SsoConfigRecord>(await apiClient.post('/auth/sso/config', payload));
    },
    onSuccess: (record) => {
      queryClient.invalidateQueries({ queryKey });
      form.reset(formFromRecord(record));
      addNotification({
        title: 'SSO provider saved',
        message: `${record.displayName} is ${record.enabled ? 'enabled' : 'saved as disabled'}.`,
        type: 'success',
        read: false,
      });
    },
    onError: (error) => {
      addNotification({
        title: 'Could not save SSO provider',
        message: mutationMessage(error),
        type: 'error',
        read: false,
      });
    },
  });

  const deleteConfig = useMutation({
    mutationFn: async (id: string) => unwrapApiData<{ ok: true }>(await apiClient.delete(`/auth/sso/config/${id}`)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      form.reset(emptyForm());
      addNotification({
        title: 'SSO provider removed',
        message: 'The identity provider was removed from this tenant.',
        type: 'success',
        read: false,
      });
    },
    onError: (error) => {
      addNotification({
        title: 'Could not remove SSO provider',
        message: mutationMessage(error),
        type: 'error',
        read: false,
      });
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    saveConfig.mutate(values);
  });

  const columns = React.useMemo<DataTableColumn<SsoConfigRecord>[]>(() => [
    {
      key: 'provider',
      header: 'Provider',
      cell: (record) => (
        <button
          type="button"
          className="text-left font-semibold text-indigo-700 hover:underline"
          onClick={() => form.reset(formFromRecord(record))}
        >
          {record.displayName}
        </button>
      ),
    },
    { key: 'protocol', header: 'Protocol', cell: (record) => record.protocol },
    { key: 'status', header: 'Status', cell: (record) => statusLabel(record) },
    { key: 'jit', header: 'JIT', cell: (record) => (record.jitProvisioning ? 'On' : 'Off') },
    {
      key: 'secret',
      header: 'Secret',
      cell: (record) => (
        record.protocol === 'OIDC'
          ? (record.hasOidcClientSecret ? 'Stored' : 'Missing')
          : (record.hasSamlSpPrivateKey ? 'Stored' : 'Optional')
      ),
    },
  ], [form]);

  const errors = form.formState.errors;

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-950 md:p-8">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
        <BusinessPageHeader
          eyebrow="System Console"
          icon={KeyRound}
          title="Single Sign-On"
          subtitle={`Manage tenant identity providers for ${tenantName}. Secrets stay encrypted and masked.`}
          actions={(
            <>
              <Button variant="outline" onClick={() => configsQuery.refetch()} disabled={configsQuery.isFetching}>
                <RefreshCcw className={`mr-2 h-4 w-4 ${configsQuery.isFetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button onClick={() => form.reset(emptyForm())}>
                <Plus className="mr-2 h-4 w-4" />
                New Provider
              </Button>
            </>
          )}
        />

        <section className="grid gap-4 lg:grid-cols-[1fr_28rem]">
          <Card>
            <CardHeader>
              <h2 className="flex items-center gap-2 font-headline text-2xl font-semibold leading-tight text-card-foreground">
                <ShieldCheck className="h-5 w-5 text-indigo-600" />
                Tenant Providers
              </h2>
            </CardHeader>
            <CardContent>
              {configsQuery.isLoading ? (
                <Skeleton className="h-64 rounded-lg" />
              ) : configsQuery.isError ? (
                <ErrorState error={configsQuery.error} onRetry={() => configsQuery.refetch()} />
              ) : records.length === 0 ? (
                <EmptyState title="No SSO providers configured" description="Create an OIDC or SAML provider to enable enterprise sign-in." />
              ) : (
                <DataTable
                  columns={columns}
                  data={records}
                  keyExtractor={(record) => record.id}
                  emptyMessage="No SSO providers configured"
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="flex items-center gap-2 font-headline text-2xl font-semibold leading-tight text-card-foreground">
                <LockKeyhole className="h-5 w-5 text-indigo-600" />
                Provider Setup
              </h2>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={onSubmit} noValidate>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField id="sso-protocol" label="Protocol">
                    <Select
                      value={watchedProtocol}
                      onValueChange={(value) => form.reset({ ...emptyForm(value as SsoProtocol), id: watchedId })}
                      disabled={Boolean(watchedId)}
                    >
                      <SelectTrigger id="sso-protocol">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OIDC">OIDC</SelectItem>
                        <SelectItem value="SAML">SAML</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField id="sso-display-name" label="Display name" error={errors.displayName?.message}>
                    <Input {...form.register('displayName')} />
                  </FormField>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium">
                    <input type="checkbox" {...form.register('enabled')} />
                    Enabled
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium">
                    <input type="checkbox" {...form.register('jitProvisioning')} />
                    JIT provisioning
                  </label>
                </div>

                <FormField id="sso-default-roles" label="Default roles">
                  <Input {...form.register('defaultRoles')} />
                </FormField>

                {watchedProtocol === 'OIDC' ? (
                  <div className="space-y-3">
                    <Field id="oidc-issuer" label="Issuer URL" registration={form.register('oidcIssuerUrl')} error={errors.oidcIssuerUrl?.message} />
                    <Field id="oidc-client-id" label="Client ID" registration={form.register('oidcClientId')} error={errors.oidcClientId?.message} />
                    <Field id="oidc-client-secret" label="Client secret" type="password" registration={form.register('oidcClientSecret')} placeholder={watchedId ? 'Leave blank to keep stored secret' : ''} />
                    <Field id="oidc-scopes" label="Scopes" registration={form.register('oidcScopes')} />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Field id="saml-entity" label="IdP entity ID" registration={form.register('samlIdpEntityId')} error={errors.samlIdpEntityId?.message} />
                    <Field id="saml-sso-url" label="IdP SSO URL" registration={form.register('samlIdpSsoUrl')} error={errors.samlIdpSsoUrl?.message} />
                    <MultilineField id="saml-cert" label="IdP certificate" registration={form.register('samlIdpX509Cert')} />
                    <MultilineField id="saml-private-key" label="SP private key" registration={form.register('samlSpPrivateKey')} placeholder={watchedId ? 'Leave blank to keep stored private key' : ''} />
                  </div>
                )}

                <MultilineField id="attribute-mapping" label="Attribute mapping" registration={form.register('attributeMapping')} error={errors.attributeMapping?.message} />
                <MultilineField id="group-role-mapping" label="Group role mapping" registration={form.register('groupRoleMapping')} error={errors.groupRoleMapping?.message} />

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button className="flex-1" type="submit" disabled={saveConfig.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    Save Provider
                  </Button>
                  {watchedId ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="text-rose-700"
                      disabled={deleteConfig.isPending}
                      onClick={() => watchedId && deleteConfig.mutate(watchedId)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  ) : null}
                </div>
              </form>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function Field({
  id,
  label,
  registration,
  error,
  placeholder,
  type = 'text',
  required,
}: {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  error?: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <FormField id={id} label={label} error={error} required={required}>
      <Input type={type} placeholder={placeholder} {...registration} />
    </FormField>
  );
}

function MultilineField({
  id,
  label,
  registration,
  error,
  placeholder,
}: {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  error?: string;
  placeholder?: string;
}) {
  return (
    <FormField id={id} label={label} error={error}>
      <textarea
        className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        placeholder={placeholder}
        {...registration}
      />
    </FormField>
  );
}
