import * as React from 'react';
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DataTable } from '@/components/common/data-table';
import { AllowedActions } from '@/components/common/allowed-actions';
import { formatDate } from '@/lib/utils';
import { Upload, CheckCircle2, Globe, FileText, AlertCircle } from 'lucide-react';
import type { CountryPolicyPack, ValidationResult } from '@/types';

/**
 * Country Policy v1.4 management page with packs, validation, simulation, and approval.
 */
export function AdminCountryPolicy() {
  const [uploadOpen, setUploadOpen] = React.useState(false);

  const [simulationResult, setSimulationResult] = React.useState<ValidationResult | null>(null);

  const { data: policyPacks, isLoading } = useApiQuery<CountryPolicyPack[]>(
    ['admin-country-policies'],
    '/admin/country-policies'
  );

  const validateMutation = useApiMutation<ValidationResult, string>(
    '/admin/country-policies/validate',
    'post'
  );

  const simulateMutation = useApiMutation<ValidationResult, string>(
    '/admin/country-policies/simulate',
    'post'
  );

  const approveMutation = useApiMutation<void, string>(
    '/admin/country-policies/approve',
    'post',
    [['admin-country-policies']]
  );

  const publishMutation = useApiMutation<void, string>(
    '/admin/country-policies/publish',
    'post',
    [['admin-country-policies']]
  );

  const handleValidate = async (packId: string) => {
    const result = await validateMutation.mutateAsync(packId);
    setSimulationResult(result);
  };

  const handleSimulate = async (packId: string) => {
    const result = await simulateMutation.mutateAsync(packId);
    setSimulationResult(result);
  };

  const columns = [
    { key: 'name', header: 'Name', cell: (row: CountryPolicyPack) => row.name },
    {
      key: 'country',
      header: 'Country',
      cell: (row: CountryPolicyPack) => (
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          {row.countryCode}
        </div>
      ),
    },
    { key: 'version', header: 'Version', cell: (row: CountryPolicyPack) => row.version },
    {
      key: 'status',
      header: 'Status',
      cell: (row: CountryPolicyPack) => {
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
      cell: (row: CountryPolicyPack) => formatDate(row.updatedAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row: CountryPolicyPack) => (
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
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6" />
            Country Policy v1.4
          </h2>
          <p className="text-muted-foreground">Manage country-specific policy packs</p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Upload Pack
        </Button>
      </div>

      {/* Validation/Simulation Result */}
      {simulationResult && (
        <Card className={simulationResult.valid ? 'border-green-200' : 'border-amber-200'}>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Policy Packs</CardTitle>
          <CardDescription>All country policy packs and their status</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={policyPacks ?? []}
            keyExtractor={(row) => row.id}
            isLoading={isLoading}
            emptyMessage="No policy packs found"
          />
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Policy Pack</DialogTitle>
            <DialogDescription>Upload a new country policy pack file</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-dashed p-8 text-center">
              <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                Drag and drop your policy pack file here, or click to browse
              </p>
              <input type="file" className="hidden" accept=".json,.yaml,.yml" />
              <Button variant="outline" className="mt-4">
                Browse Files
              </Button>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setUploadOpen(false)}>
                Cancel
              </Button>
              <Button>Upload</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
