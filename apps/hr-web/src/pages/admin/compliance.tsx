
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
  const [policyForm, setPolicyForm] = React.useState<PolicyForm>(emptyPolicyForm);

  const { data, isLoading } = useQuery({
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
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="h-6 w-6" />
            Compliance
          </h2>
          <p className="text-muted-foreground">Policy management and compliance tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link to="/admin/policies">Policy Center</Link>
          </Button>
          <AllowedActions
            aggregateType="COMPLIANCE"
          />
        </div>
      </div>

      <Card>
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
          <Card>
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
          <Card>
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
          <Card>
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
                    <div key={hold.id} className="flex items-start gap-3 rounded-lg border p-4">
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
                <p className="text-sm text-muted-foreground">No active legal holds</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card>
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
                    <div key={report.id} className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <p className="text-sm font-medium">{report.name}</p>
                        <p className="text-xs text-muted-foreground">Due: {formatDate(report.dueDate)}</p>
                      </div>
                      <Badge variant="outline">{report.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No statutory reports due</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
