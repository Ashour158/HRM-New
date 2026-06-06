import * as React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/common/data-table';
import { AllowedActions } from '@/components/common/allowed-actions';
import { ErrorState } from '@/components/common/error-state';
import { useUIStore } from '@/stores/ui-store';
import { formatDate } from '@/lib/utils';
import { CheckCircle2, Globe, AlertCircle, Upload } from 'lucide-react';
import type { CountryPolicyPack, ValidationResult } from '@/types';

type CountryPolicyPackApi = CountryPolicyPack & {
  countryPackVersion?: string;
  effectiveFrom?: string;
};

type PackForm = {
  countryCode: string;
  version: string;
  effectiveFrom: string;
};

function apiData<T>(payload: unknown): T {
  const response = payload as { data?: T; success?: boolean };
  if (response.success === true && response.data !== undefined) return response.data;
  return payload as T;
}

function unwrap<T>(response: { data: unknown }) {
  return apiData<T>(response.data);
}

/**
 * Country Policy v1.4 management page with packs, validation, simulation, and approval.
 */
export function AdminCountryPolicy() {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((s) => s.addNotification);
  const [simulationResult, setSimulationResult] = React.useState<ValidationResult | null>(null);
  const [packForm, setPackForm] = React.useState<PackForm>({
    countryCode: 'EG',
    version: '2026.1',
    effectiveFrom: new Date().toISOString().slice(0, 10),
  });

  const { data: policyPacks, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-country-policies'],
    queryFn: async () => unwrap<CountryPolicyPackApi[]>(await apiClient.get('/country-policy/policy-packs')),
  });

  const refreshPacks = () => queryClient.invalidateQueries({ queryKey: ['admin-country-policies'] });

  const notifyError = (mutationError: unknown, fallback: string) => {
    const message = mutationError instanceof Error ? mutationError.message : fallback;
    addNotification({ title: 'Something went wrong', message, type: 'error', read: false });
  };

  const uploadMutation = useMutation({
    mutationFn: async (form: PackForm) => apiClient.post('/country-policy/policy-packs', {
      packId: crypto.randomUUID(),
      countryCode: form.countryCode.toUpperCase(),
      version: form.version,
      effectiveFrom: form.effectiveFrom,
      uploadedBy: crypto.randomUUID(),
      sections: {
        leave: { source: 'admin-ui' },
        payroll: { source: 'admin-ui' },
      },
    }),
    onSuccess: () => {
      refreshPacks();
      addNotification({ title: 'Pack uploaded', message: 'The country policy pack was uploaded.', type: 'success', read: false });
    },
    onError: (mutationError) => notifyError(mutationError, 'Unable to upload the policy pack.'),
  });

  const validateMutation = useMutation({
    mutationFn: async (packId: string) => unwrap<ValidationResult>(await apiClient.post('/country-policy/policy-packs/validate', {
      packId,
      validationRunId: crypto.randomUUID(),
      validationType: 'FULL_POLICY_PACK',
    })),
    onError: (mutationError) => notifyError(mutationError, 'Unable to validate the policy pack.'),
  });

  const simulateMutation = useMutation({
    mutationFn: async (packId: string) => unwrap<ValidationResult>(await apiClient.post('/country-policy/policy-packs/simulate', {
      packId,
      simulationRunId: crypto.randomUUID(),
      simulationScope: 'TENANT_ACTIVE_WORKFORCE',
    })),
    onError: (mutationError) => notifyError(mutationError, 'Unable to simulate the policy pack.'),
  });

  const approveMutation = useMutation({
    mutationFn: async (packId: string) => apiClient.post('/country-policy/policy-packs/approve', {
      packId,
      approvedBy: crypto.randomUUID(),
    }),
    onSuccess: () => {
      refreshPacks();
      addNotification({ title: 'Pack approved', message: 'The country policy pack was approved.', type: 'success', read: false });
    },
    onError: (mutationError) => notifyError(mutationError, 'Unable to approve the policy pack.'),
  });

  const publishMutation = useMutation({
    mutationFn: async (packId: string) => apiClient.post('/country-policy/policy-packs/publish', {
      packId,
      publishedBy: crypto.randomUUID(),
    }),
    onSuccess: () => {
      refreshPacks();
      addNotification({ title: 'Pack published', message: 'The country policy pack was published.', type: 'success', read: false });
    },
    onError: (mutationError) => notifyError(mutationError, 'Unable to publish the policy pack.'),
  });

  const handleValidate = async (packId: string) => {
    const result = await validateMutation.mutateAsync(packId);
    setSimulationResult(result);
  };

  const handleSimulate = async (packId: string) => {
    const result = await simulateMutation.mutateAsync(packId);
    setSimulationResult(result);
  };

  const columns = [
    { key: 'name', header: 'Name', cell: (row: CountryPolicyPackApi) => row.name ?? `${row.countryCode} policy pack` },
    {
      key: 'country',
      header: 'Country',
      cell: (row: CountryPolicyPackApi) => (
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          {row.countryCode}
        </div>
      ),
    },
    { key: 'version', header: 'Version', cell: (row: CountryPolicyPackApi) => row.version ?? row.countryPackVersion ?? '-' },
    {
      key: 'status',
      header: 'Status',
      cell: (row: CountryPolicyPackApi) => {
        const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
          DRAFT: 'outline',
          PENDING_APPROVAL: 'secondary',
          APPROVED: 'default',
          PUBLISHED: 'default',
          ARCHIVED: 'destructive',
        };
        return <Badge variant={variants[row.status] || 'default'}>{row.status}</Badge>;
      },
    },
    {
      key: 'updated',
      header: 'Updated',
      cell: (row: CountryPolicyPackApi) => formatDate(row.updatedAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row: CountryPolicyPackApi) => (
        <AllowedActions
          aggregateType="COUNTRY_POLICY"
          aggregateId={row.id}
          onAction={(action) => {
            if (action.action === 'VALIDATE') handleValidate(row.id);
            if (action.action === 'SIMULATE') handleSimulate(row.id);
            if (action.action === 'APPROVE') approveMutation.mutate(row.id);
            if (action.action === 'PUBLISH') publishMutation.mutate(row.id);
          }}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-white/60 bg-white/60 py-1 pl-2 pr-3 text-xs font-bold text-slate-600 backdrop-blur-md">
            <span className="relative flex h-2.5 w-2.5">
              <span className="fusion-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            Policy packs live
          </div>
          <h1 className="fusion-gradient-text text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6" />
            Country Policy v1.4
          </h1>
          <p className="text-muted-foreground">Manage country-specific policy packs</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/admin/system-console/policies">Policy Center</Link>
        </Button>
      </div>

      <Card className="fusion-glass rounded-[2rem] border-transparent">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Add Country Policy Pack
          </CardTitle>
          <CardDescription>Upload a versioned policy pack and then validate, approve, and publish it.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-[9rem_10rem_12rem_auto]" onSubmit={(event) => {
            event.preventDefault();
            uploadMutation.mutate(packForm);
          }}>
            <div className="space-y-2">
              <Label htmlFor="country-code">Country</Label>
              <Input id="country-code" maxLength={2} value={packForm.countryCode} onChange={(event) => setPackForm({ ...packForm, countryCode: event.target.value.toUpperCase() })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pack-version">Version</Label>
              <Input id="pack-version" value={packForm.version} onChange={(event) => setPackForm({ ...packForm, version: event.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="effective-from">Effective From</Label>
              <Input id="effective-from" type="date" value={packForm.effectiveFrom} onChange={(event) => setPackForm({ ...packForm, effectiveFrom: event.target.value })} required />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={uploadMutation.isPending}>Upload Pack</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Validation/Simulation Result */}
      {simulationResult && (
        <Card className={`fusion-glass rounded-2xl ${simulationResult.valid ? 'border-green-200' : 'border-amber-200'}`}>
          <CardHeader>
            <div className="flex items-center gap-2">
              {simulationResult.valid ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              )}
              <CardTitle className="text-lg">
                {simulationResult.valid ? 'Validation Passed' : 'Validation Issues Found'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {simulationResult.errors.length > 0 && (
              <div>
                <p className="text-sm font-medium text-destructive mb-1">Errors:</p>
                <ul className="list-disc list-inside text-sm text-destructive">
                  {simulationResult.errors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            {simulationResult.warnings.length > 0 && (
              <div>
                <p className="text-sm font-medium text-amber-600 mb-1">Warnings:</p>
                <ul className="list-disc list-inside text-sm text-amber-600">
                  {simulationResult.warnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => setSimulationResult(null)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="fusion-glass rounded-[2rem] border-transparent">
        <CardHeader>
          <CardTitle className="text-lg">Policy Packs</CardTitle>
          <CardDescription>All country policy packs and their status</CardDescription>
        </CardHeader>
        <CardContent>
          {isError ? (
            <ErrorState error={error} onRetry={() => refetch()} />
          ) : (
            <DataTable
              columns={columns}
              data={policyPacks ?? []}
              keyExtractor={(row) => row.id}
              isLoading={isLoading}
              emptyMessage="No policy packs found"
            />
          )}
        </CardContent>
      </Card>

    </div>
  );
}
