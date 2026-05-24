import * as React from 'react';
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

import { DataTable } from '@/components/common/data-table';
import { FieldMask } from '@/components/common/field-mask';
import { AllowedActions } from '@/components/common/allowed-actions';
import { AuditTrail } from '@/components/common/audit-trail';
import { formatDate } from '@/lib/utils';
import { Search, Plus, UserMinus, UserCheck, Eye } from 'lucide-react';
import type { Worker } from '@/types';

interface CreateWorkerForm {
  firstName: string;
  lastName: string;
  email?: string;
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ACTIVE':
      return 'default';
    case 'DRAFT':
    case 'PENDING_ACTIVATION':
      return 'secondary';
    case 'TERMINATED':
    case 'SUSPENDED':
      return 'destructive';
    default:
      return 'outline';
  }
}

/**
 * Worker management page with search, filters, pagination, and lifecycle actions.
 */
export function AdminWorkers() {
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [selectedWorker, setSelectedWorker] = React.useState<Worker | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createForm, setCreateForm] = React.useState<CreateWorkerForm>({ firstName: '', lastName: '', email: '' });

  const { data: workersData, isLoading, refetch } = useApiQuery<Worker[]>(
    ['admin-workers', search, page],
    `/hr/core/workers?search=${encodeURIComponent(search)}&page=${page}&pageSize=10`
  );

  const data = workersData ? { items: workersData, total: workersData.length } : undefined;

  const createMutation = useApiMutation<Worker, CreateWorkerForm & { workerId: string }>(
    '/hr/core/workers',
    'post',
    [['admin-workers']]
  );

  const activateMutation = useApiMutation<void, { workerId: string }>(
    (vars) => `/hr/core/workers/${vars.workerId}/commands/activate`,
    'post',
    [['admin-workers']]
  );

  const terminateMutation = useApiMutation<void, { workerId: string; reason: string }>(
    (vars) => `/hr/core/workers/${vars.workerId}/commands/terminate`,
    'post',
    [['admin-workers']]
  );

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleCreate = async () => {
    const workerId = crypto.randomUUID();
    await createMutation.mutateAsync({
      workerId,
      firstName: createForm.firstName,
      lastName: createForm.lastName,
      email: createForm.email,
    });
    setCreateOpen(false);
    setCreateForm({ firstName: '', lastName: '', email: '' });
    refetch();
  };

  const handleActivate = async (workerId: string) => {
    await activateMutation.mutateAsync({ workerId });
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
        <Badge variant={getStatusVariant(row.status)}>{row.status}</Badge>
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
          {(row.status === 'DRAFT' || row.status === 'PENDING_ACTIVATION') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleActivate(row.id)}
              aria-label="Activate worker"
              className="text-green-600 hover:text-green-700"
            >
              <UserCheck className="h-4 w-4" />
            </Button>
          )}
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
        <Button onClick={() => setCreateOpen(true)}>
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

      {/* Create Worker Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Worker</DialogTitle>
            <DialogDescription>Create a new worker record.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={createForm.firstName}
                onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                placeholder="Jane"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={createForm.lastName}
                onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                placeholder="Doe"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="jane.doe@example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!createForm.firstName || !createForm.lastName || createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Worker'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
