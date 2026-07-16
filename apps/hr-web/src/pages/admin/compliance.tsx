
import * as React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/common/data-table';
import { AllowedActions } from '@/components/common/allowed-actions';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { useUIStore } from '@/stores/ui-store';
import { formatDate } from '@/lib/utils';
import { FileText, CheckCircle2, AlertTriangle, Scale, Gavel } from 'lucide-react';

interface PolicyDocument {
  id: string;
  title: string;
  version: string;
  effectiveDate: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'ARCHIVED';
  requiresAcknowledgement: boolean;
}

interface Acknowledgement {
  id: string;
  workerName: string;
  policyTitle: string;
  acknowledgedAt: string;
  status: 'ACKNOWLEDGED' | 'PENDING' | 'OVERDUE';
}

interface ComplianceData {
  policies: PolicyDocument[];
  acknowledgements: Acknowledgement[];
  legalHolds: Array<{ id: string; description: string; issuedAt: string; status: string }>;
  statutoryReports: Array<{ id: string; name: string; dueDate: string; status: string }>;
}

interface PolicyForm {
  title: string;
  documentType: string;
  documentVersion: string;
  effectiveFrom: string;
  requiresAcknowledgement: boolean;
}

const emptyPolicyForm: PolicyForm = {
  title: '',
  documentType: 'HR_POLICY',
  documentVersion: '1.0',
  effectiveFrom: new Date().toISOString().slice(0, 10),
  requiresAcknowledgement: true,
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
 * Compliance management page with policies, acknowledgements, legal holds, and reports.
 */
export function AdminCompliance() {
  const queryClient = useQueryClient();
  const addNotification = useUIStore((s) => s.addNotification);
  const [policyForm, setPolicyForm] = React.useState<PolicyForm>(emptyPolicyForm);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-compliance'],
    queryFn: async () => unwrap<ComplianceData>(await apiClient.get('/compliance/summary')),
  });

  const createPolicy = useMutation({
    mutationFn: async (form: PolicyForm) => apiClient.post('/compliance/policy-documents', {
      documentId: crypto.randomUUID(),
      title: form.title,
      documentType: form.documentType,
      version: form.documentVersion,
      effectiveFrom: form.effectiveFrom,
      content: {
        requiresAcknowledgement: form.requiresAcknowledgement,
        source: 'admin-ui',
      },
    }),
    onSuccess: () => {
      setPolicyForm(emptyPolicyForm);
      queryClient.invalidateQueries({ queryKey: ['admin-compliance'] });
      addNotification({ title: 'Policy created', message: 'The policy document was created.', type: 'success', read: false });
    },
    onError: (mutationError: unknown) => {
      const message = mutationError instanceof Error ? mutationError.message : 'Unable to create the policy document.';
      addNotification({ title: 'Something went wrong', message, type: 'error', read: false });
    },
  });

  const policyColumns = [
    { key: 'title', header: 'Title', cell: (row: PolicyDocument) => row.title },
    { key: 'version', header: 'Version', cell: (row: PolicyDocument) => row.version },
    {
      key: 'effectiveDate',
      header: 'Effective Date',
      cell: (row: PolicyDocument) => formatDate(row.effectiveDate),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row: PolicyDocument) => (
        <Badge variant={row.status === 'PUBLISHED' ? 'default' : 'secondary'}>{row.status}</Badge>
      ),
    },
    {
      key: 'requiresAck',
      header: 'Requires Ack',
      cell: (row: PolicyDocument) => (row.requiresAcknowledgement ? 'Yes' : 'No'),
    },
  ];

  const ackColumns = [
    { key: 'worker', header: 'Employee', cell: (row: Acknowledgement) => row.workerName },
    { key: 'policy', header: 'Policy', cell: (row: Acknowledgement) => row.policyTitle },
    {
      key: 'status',
      header: 'Status',
      cell: (row: Acknowledgement) => {
        const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
          ACKNOWLEDGED: 'default',
          PENDING: 'secondary',
          OVERDUE: 'destructive',
        };
        return <Badge variant={variants[row.status] || 'default'}>{row.status}</Badge>;
      },
    },
    {
      key: 'date',
      header: 'Acknowledged',
      cell: (row: Acknowledgement) => (row.acknowledgedAt ? formatDate(row.acknowledgedAt) : '-'),
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
            Compliance monitoring live
          </div>
          <h1 className="fusion-gradient-text text-2xl font-bold flex items-center gap-2">
            <Scale className="h-6 w-6" />
            Compliance
          </h1>
          <p className="text-muted-foreground">Policy management and compliance tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link to="/admin/system-console/policies">Policy Center</Link>
          </Button>
          <AllowedActions
            aggregateType="COMPLIANCE"
          />
        </div>
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : null}

      {/* Establishes the h2 level between the page h1 and the card titles (h3),
          so the heading order is valid (a11y: heading-order). */}
      <h2 className="sr-only">Compliance workspace</h2>

      <Card className="fusion-glass rounded-[2rem] border-transparent">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Add Policy Document
          </CardTitle>
          <CardDescription>Create a policy document that can be approved, published, and acknowledged.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-[1fr_10rem_8rem_12rem_auto]" onSubmit={(event) => {
            event.preventDefault();
            createPolicy.mutate(policyForm);
          }}>
            <div className="space-y-2">
              <Label htmlFor="policy-title">Title</Label>
              <Input id="policy-title" value={policyForm.title} onChange={(event) => setPolicyForm({ ...policyForm, title: event.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="policy-type">Type</Label>
              <Input id="policy-type" value={policyForm.documentType} onChange={(event) => setPolicyForm({ ...policyForm, documentType: event.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="policy-version">Version</Label>
              <Input id="policy-version" value={policyForm.documentVersion} onChange={(event) => setPolicyForm({ ...policyForm, documentVersion: event.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="policy-effective">Effective From</Label>
              <Input id="policy-effective" type="date" value={policyForm.effectiveFrom} onChange={(event) => setPolicyForm({ ...policyForm, effectiveFrom: event.target.value })} required />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={createPolicy.isPending}>Create Policy</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Tabs defaultValue="policies" className="space-y-4">
        <TabsList>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="acknowledgements">Acknowledgements</TabsTrigger>
          <TabsTrigger value="legal-holds">Legal Holds</TabsTrigger>
          <TabsTrigger value="reports">Statutory Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="policies">
          <Card className="fusion-glass rounded-2xl border-transparent">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Policy Documents
              </CardTitle>
              <CardDescription>Manage organizational policies</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={policyColumns}
                data={data?.policies ?? []}
                keyExtractor={(row) => row.id}
                isLoading={isLoading}
                emptyMessage="No policies found"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="acknowledgements">
          <Card className="fusion-glass rounded-2xl border-transparent">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Acknowledgement Tracking
              </CardTitle>
              <CardDescription>Track policy acknowledgement status</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={ackColumns}
                data={data?.acknowledgements ?? []}
                keyExtractor={(row) => row.id}
                isLoading={isLoading}
                emptyMessage="No acknowledgement records"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="legal-holds">
          <Card className="fusion-glass rounded-2xl border-transparent">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Gavel className="h-5 w-5" />
                Legal Holds
              </CardTitle>
              <CardDescription>Active legal hold notices</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : data?.legalHolds && data.legalHolds.length > 0 ? (
                <div className="space-y-3">
                  {data.legalHolds.map((hold) => (
                    <div key={hold.id} className="flex items-start gap-3 fusion-glass rounded-2xl border-transparent p-4">
                      <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">{hold.description}</p>
                        <p className="text-xs text-muted-foreground">
                          Issued: {formatDate(hold.issuedAt)} • Status: {hold.status}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Gavel} title="No active legal holds" description="Legal hold notices will appear here once issued." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card className="fusion-glass rounded-2xl border-transparent">
            <CardHeader>
              <CardTitle className="text-lg">Statutory Reports</CardTitle>
              <CardDescription>Required compliance reports and deadlines</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : data?.statutoryReports && data.statutoryReports.length > 0 ? (
                <div className="space-y-3">
                  {data.statutoryReports.map((report) => (
                    <div key={report.id} className="flex items-center justify-between fusion-glass rounded-2xl border-transparent p-4">
                      <div>
                        <p className="text-sm font-medium">{report.name}</p>
                        <p className="text-xs text-muted-foreground">Due: {formatDate(report.dueDate)}</p>
                      </div>
                      <Badge variant="outline">{report.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={FileText} title="No statutory reports due" description="Required compliance reports will appear here when scheduled." />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
