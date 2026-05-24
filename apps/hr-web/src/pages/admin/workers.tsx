import * as React from 'react';
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

import { DataTable } from '@/components/common/data-table';
import { FieldMask } from '@/components/common/field-mask';
import { AllowedActions } from '@/components/common/allowed-actions';
import { AuditTrail } from '@/components/common/audit-trail';
import { formatDate } from '@/lib/utils';
import { Search, Plus, UserMinus, Eye } from 'lucide-react';
import type { Worker, PaginatedResponse } from '@/types';

/**
 * Worker management page with search, filters, pagination, and lifecycle actions.
 */
export function AdminWorkers() {
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [selectedWorker, setSelectedWorker] = React.useState<Worker | null>(null);


  const { data, isLoading } = useApiQuery<PaginatedResponse<Worker>>(
    ['admin-workers', search, page],
    `/admin/workers?search=${encodeURIComponent(search)}&page=${page}`
  );

  const terminateMutation = useApiMutation<void, { workerId: string; reason: string }>(
    '/admin/workers/terminate',
    'post',
    [['admin-workers']]
  );

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleTerminate = async (workerId: string) => {
    const reason = window.prompt('Enter termination reason:');
    if (reason) {
      await terminateMutation.mutateAsync({ workerId, reason });
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      cell: (row: Worker) => (
        <button
          className="text-sm font-medium text-primary hover:underline text-left"
          onClick={() => setSelectedWorker(row)}
        >
          {row.firstName} {row.lastName}
        </button>
      ),
    },
    { key: 'employeeId', header: 'Employee ID', cell: (row: Worker) => row.employeeId },
    { key: 'email', header: 'Email', cell: (row: Worker) => row.email },
    { key: 'jobTitle', header: 'Job Title', cell: (row: Worker) => row.jobTitle || '-' },
    { key: 'department', header: 'Department', cell: (row: Worker) => row.departmentName || '-' },
    {
      key: 'status',
      header: 'Status',
      cell: (row: Worker) => (
        <Badge variant={row.status === 'ACTIVE' ? 'default' : 'secondary'}>{row.status}</Badge>
      ),
    },
    {
      key: 'hireDate',
      header: 'Hire Date',
      cell: (row: Worker) => formatDate(row.hireDate),
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row: Worker) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedWorker(row)} aria-label="View worker">
            <Eye className="h-4 w-4" />
          </Button>
          {row.status === 'ACTIVE' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleTerminate(row.id)}
              aria-label="Terminate worker"
              className="text-destructive hover:text-destructive"
            >
              <UserMinus className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (selectedWorker) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setSelectedWorker(null)}>
              ← Back to Workers
            </Button>
            <div>
              <h2 className="text-2xl font-bold">{selectedWorker.firstName} {selectedWorker.lastName}</h2>
              <p className="text-muted-foreground">{selectedWorker.employeeId}</p>
            </div>
          </div>
          <AllowedActions
            aggregateType="WORKER"
            aggregateId={selectedWorker.id}
            onAction={(action) => console.log('Action:', action)}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Worker Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Email</p>
                <FieldMask
                  value={selectedWorker.email}
                  decision="VISIBLE"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Phone</p>
                <FieldMask
                  value={selectedWorker.phone}
                  decision="MASKED"
                  maskingRule="PHONE_MASK"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Hire Date</p>
                <p className="text-sm font-medium">{formatDate(selectedWorker.hireDate)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Department</p>
                <p className="text-sm font-medium">{selectedWorker.departmentName}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Manager</p>
                <p className="text-sm font-medium">{selectedWorker.managerName}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Legal Entity</p>
                <p className="text-sm font-medium">{selectedWorker.legalEntityName}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <AllowedActions
                aggregateType="WORKER"
                aggregateId={selectedWorker.id}
                onAction={(action) => console.log('Action:', action)}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Audit Trail</CardTitle>
          </CardHeader>
          <CardContent>
            <AuditTrail resourceType="WORKER" resourceId={selectedWorker.id} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Workers</h2>
          <p className="text-muted-foreground">Manage employee records and lifecycle</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Worker
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search workers..."
            value={search}
            onChange={handleSearch}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            keyExtractor={(row) => row.id}
            isLoading={isLoading}
            emptyMessage="No workers found"
            page={page}
            pageSize={10}
            total={data?.total ?? 0}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
