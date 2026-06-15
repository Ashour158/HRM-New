import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, LockKeyhole, Plus, RefreshCcw, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useTenant } from '@/hooks/use-tenant';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { BusinessPageHeader } from '@/components/common/business-page';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
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

interface SsoConfigForm {
  id?: string;
  protocol: SsoProtocol;
  displayName: string;
  enabled: boolean;
  jitProvisioning: boolean;
  defaultRoles: string;
  attributeMapping: string;
  groupRoleMapping: string;
  oidcIssuerUrl: string;
  oidcClientId: string;
  oidcClientSecret: string;
  oidcScopes: string;
  samlIdpEntityId: string;
  samlIdpSsoUrl: string;
  samlIdpX509Cert: string;
  samlSpPrivateKey: string;
}

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
  const [form, setForm] = React.useState<SsoConfigForm>(() => emptyForm());
  const [didAutoSelect, setDidAutoSelect] = React.useState(false);

  const queryKey = React.useMemo(() => ['sso-config', tenantId], [tenantId]);
  const configsQuery = useQuery({
    queryKey,
    enabled: Boolean(tenantId),
    queryFn: async () => unwrapApiData<SsoConfigRecord[]>(await apiClient.get('/auth/sso/config')),
  });

  const records = React.useMemo(() => configsQuery.data ?? [], [configsQuery.data]);

  React.useEffect(() => {
    setDidAutoSelect(false);
    setForm(emptyForm());
  }, [tenantId]);

  React.useEffect(() => {
    if (!didAutoSelect && records.length > 0) {
      setForm(formFromRecord(records[0]));
      setDidAutoSelect(true);
    }
  }, [didAutoSelect, records]);

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
      setForm(formFromRecord(record));
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
      setForm(emptyForm());
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

  const columns = React.useMemo<DataTableColumn<SsoConfigRecord>[]>(() => [
    {
      key: 'provider',
      header: 'Provider',
      cell: (record) => (
        <button
          type="button"
          className="text-left font-semibold text-indigo-700 hover:underline"
          onClick={() => setForm(formFromRecord(record))}
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
  ], []);

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
              <Button onClick={() => setForm(emptyForm())}>
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
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveConfig.mutate(form);
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="sso-protocol">Protocol</Label>
                    <Select
                      value={form.protocol}
                      onValueChange={(value) => setForm((current) => ({ ...emptyForm(value as SsoProtocol), id: current.id }))}
                      disabled={Boolean(form.id)}
                    >
                      <SelectTrigger id="sso-protocol">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OIDC">OIDC</SelectItem>
                        <SelectItem value="SAML">SAML</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sso-display-name">Display name</Label>
                    <Input
                      id="sso-display-name"
                      value={form.displayName}
                      onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={form.enabled}
                      onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
                    />
                    Enabled
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={form.jitProvisioning}
                      onChange={(event) => setForm((current) => ({ ...current, jitProvisioning: event.target.checked }))}
                    />
                    JIT provisioning
                  </label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sso-default-roles">Default roles</Label>
                  <Input
                    id="sso-default-roles"
                    value={form.defaultRoles}
                    onChange={(event) => setForm((current) => ({ ...current, defaultRoles: event.target.value }))}
                  />
                </div>

                {form.protocol === 'OIDC' ? (
                  <div className="space-y-3">
                    <Field id="oidc-issuer" label="Issuer URL" value={form.oidcIssuerUrl} onChange={(value) => setForm((current) => ({ ...current, oidcIssuerUrl: value }))} />
                    <Field id="oidc-client-id" label="Client ID" value={form.oidcClientId} onChange={(value) => setForm((current) => ({ ...current, oidcClientId: value }))} />
                    <Field id="oidc-client-secret" label="Client secret" type="password" value={form.oidcClientSecret} placeholder={form.id ? 'Leave blank to keep stored secret' : ''} onChange={(value) => setForm((current) => ({ ...current, oidcClientSecret: value }))} />
                    <Field id="oidc-scopes" label="Scopes" value={form.oidcScopes} onChange={(value) => setForm((current) => ({ ...current, oidcScopes: value }))} />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Field id="saml-entity" label="IdP entity ID" value={form.samlIdpEntityId} onChange={(value) => setForm((current) => ({ ...current, samlIdpEntityId: value }))} />
                    <Field id="saml-sso-url" label="IdP SSO URL" value={form.samlIdpSsoUrl} onChange={(value) => setForm((current) => ({ ...current, samlIdpSsoUrl: value }))} />
                    <MultilineField id="saml-cert" label="IdP certificate" value={form.samlIdpX509Cert} onChange={(value) => setForm((current) => ({ ...current, samlIdpX509Cert: value }))} />
                    <MultilineField id="saml-private-key" label="SP private key" value={form.samlSpPrivateKey} placeholder={form.id ? 'Leave blank to keep stored private key' : ''} onChange={(value) => setForm((current) => ({ ...current, samlSpPrivateKey: value }))} />
                  </div>
                )}

                <MultilineField id="attribute-mapping" label="Attribute mapping" value={form.attributeMapping} onChange={(value) => setForm((current) => ({ ...current, attributeMapping: value }))} />
                <MultilineField id="group-role-mapping" label="Group role mapping" value={form.groupRoleMapping} onChange={(value) => setForm((current) => ({ ...current, groupRoleMapping: value }))} />

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button className="flex-1" type="submit" disabled={!form.displayName.trim() || saveConfig.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    Save Provider
                  </Button>
                  {form.id ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="text-rose-700"
                      disabled={deleteConfig.isPending}
                      onClick={() => form.id && deleteConfig.mutate(form.id)}
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
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function MultilineField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
