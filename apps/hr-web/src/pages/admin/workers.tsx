import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/common/data-table';
import { formatDate } from '@/lib/utils';
import { Download, FileSpreadsheet, Search, Plus, Upload, UserMinus, UserCheck, Eye } from 'lucide-react';
import type { Worker } from '@/types';

interface EmployeeMassUpdateRow {
  employeeId?: string;
  firstName?: string;
  lastName?: string;
  workEmail?: string;
  personalEmail?: string;
  phoneNumber?: string;
  workPhoneNumber?: string;
  department?: string;
  jobTitle?: string;
  workLocationCode?: string;
  grossSalary?: number;
  currency?: string;
}

interface EmployeeMassUpdatePreview {
  accepted: boolean;
  rowCount: number;
  errors: Array<{ row: number; field: string; message: string }>;
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

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseSimpleCsv(text: string): EmployeeMassUpdateRow[] {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(',').map((item) => item.trim());
  return lines.filter(Boolean).map((line) => {
    const values = line.split(',').map((item) => item.trim());
    return headers.reduce<EmployeeMassUpdateRow>((row, header, index) => {
      const value = values[index];
      if (!value) return row;
      if (header === 'grossSalary') return { ...row, grossSalary: Number(value) };
      return { ...row, [header]: value };
    }, {});
  });
}

/**
 * Employee management list with search, pagination, and lifecycle shortcuts.
 */
export function AdminWorkers() {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [uploadPreview, setUploadPreview] = React.useState<EmployeeMassUpdatePreview | null>(null);

  const { data: workersData, isLoading, refetch } = useApiQuery<Worker[]>(
    ['admin-workers', search, page],
    `/hr/core/workers?search=${encodeURIComponent(search)}&page=${page}&pageSize=10`
  );

  const workerItems: Worker[] = Array.isArray(workersData)
    ? workersData
    : (workersData as { items?: Worker[] } | undefined)?.items ?? [];
  const data = {
    items: workerItems,
    total: Array.isArray(workersData)
      ? workersData.length
      : (workersData as { total?: number } | undefined)?.total ?? workerItems.length,
  };

  const activateMutation = useApiMutation<void, { workerId: string }>(
    (vars) => `/hr/core/workers/${vars.workerId}/commands/activate`,
    'post',
    [['admin-workers']]
  );

  const terminateMutation = useApiMutation<void, { workerId: string; reason: string; terminationDate: string }>(
    (vars) => `/hr/core/workers/${vars.workerId}/commands/terminate`,
    'post',
    [['admin-workers']]
  );

  const massPreviewMutation = useApiMutation<EmployeeMassUpdatePreview, { rows: EmployeeMassUpdateRow[] }>(
    '/hr/core/workers/mass-update-preview',
    'post',
  );

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleActivate = async (workerId: string) => {
    await activateMutation.mutateAsync({ workerId });
    refetch();
  };

  const handleTerminate = async (workerId: string) => {
    const reason = window.prompt('Enter termination reason:');
    if (reason) {
      await terminateMutation.mutateAsync({ workerId, reason, terminationDate: new Date().toISOString() });
      refetch();
    }
  };

  const downloadCsv = async (url: string, filename: string) => {
    const response = await apiClient.get(url, { responseType: 'blob' });
    downloadBlob(response.data as Blob, filename);
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    const result = await massPreviewMutation.mutateAsync({ rows: parseSimpleCsv(await file.text()) });
    setUploadPreview(result);
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      cell: (row: Worker) => (
        <button
          className="text-left text-sm font-medium text-primary hover:underline"
          onClick={() => navigate(`/admin/employees/${row.id}`)}
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
      cell: (row: Worker) => <Badge variant={getStatusVariant(row.status)}>{row.status}</Badge>,
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
          <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/employees/${row.id}`)} aria-label="View employee">
            <Eye className="h-4 w-4" />
          </Button>
          {(row.status === 'DRAFT' || row.status === 'PENDING_ACTIVATION') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleActivate(row.id)}
              aria-label="Activate employee"
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
              aria-label="Terminate employee"
              className="text-destructive hover:text-destructive"
            >
              <UserMinus className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold fusion-gradient-text">Employees</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 fusion-pulse" />
              Live
            </span>
          </div>
          <p className="text-slate-500">Manage employee records and lifecycle</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => downloadCsv('/hr/core/workers/export.csv', 'employees.csv')}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" onClick={() => downloadCsv('/hr/core/workers/mass-update-template.csv', 'employee-template.csv')}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Template
          </Button>
          <label className="inline-flex cursor-pointer items-center rounded-md border px-4 py-2 text-sm font-medium">
            <Upload className="mr-2 h-4 w-4" />
            Upload
            <Input className="hidden" type="file" accept=".csv,text/csv" onChange={(event) => handleUpload(event.target.files?.[0])} />
          </label>
          <Button onClick={() => navigate('/admin/employees/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Add Employee
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            value={search}
            onChange={handleSearch}
            className="pl-9"
          />
        </div>
      </div>

      <section className="fusion-glass rounded-[2rem] p-6">
        {uploadPreview ? (
          <div className="mb-4 fusion-glass rounded-2xl p-4 text-sm">
            <Badge variant={uploadPreview.accepted ? 'default' : 'destructive'}>
              {uploadPreview.accepted ? `${uploadPreview.rowCount} rows accepted` : `${uploadPreview.errors.length} validation errors`}
            </Badge>
            {uploadPreview.errors.length > 0 ? (
              <div className="mt-3 space-y-1">
                {uploadPreview.errors.slice(0, 5).map((error) => (
                  <p key={`${error.row}-${error.field}-${error.message}`}>Row {error.row}: {error.field} - {error.message}</p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={(row) => row.id}
          isLoading={isLoading}
          emptyMessage="No employees found"
          page={page}
          pageSize={10}
          total={data?.total ?? 0}
          onPageChange={setPage}
        />
      </section>
    </div>
  );
}
