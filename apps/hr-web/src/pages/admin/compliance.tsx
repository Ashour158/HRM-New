
import { useApiQuery } from '@/hooks/use-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
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

/**
 * Compliance management page with policies, acknowledgements, legal holds, and reports.
 */
export function AdminCompliance() {
  const { data, isLoading } = useApiQuery<ComplianceData>(
    ['admin-compliance'],
    '/admin/compliance'
  );

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
    { key: 'worker', header: 'Worker', cell: (row: Acknowledgement) => row.workerName },
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
        <AllowedActions
          aggregateType="COMPLIANCE"
          onAction={(action) => console.log('Compliance action:', action)}
        />
      </div>

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
