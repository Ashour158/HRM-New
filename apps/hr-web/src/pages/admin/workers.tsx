import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/common/data-table';
import { ErrorState } from '@/components/common/error-state';
import { useUIStore } from '@/stores/ui-store';
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
  const addNotification = useUIStore((state) => state.addNotification);
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [uploadPreview, setUploadPreview] = React.useState<EmployeeMassUpdatePreview | null>(null);

  const { data: workersData, isLoading, isError, error, refetch } = useApiQuery<Worker[]>(
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
    try {
      await activateMutation.mutateAsync({ workerId });
      refetch();
      addNotification({ title: 'Employee activated', message: 'The employee record is now active.', type: 'success', read: false });
    } catch (err) {
      addNotification({ title: 'Activation failed', message: err instanceof Error ? err.message : 'Could not activate employee.', type: 'error', read: false });
    }
  };

  const handleTerminate = async (workerId: string) => {
    const reason = window.prompt('Enter termination reason:');
    if (reason) {
      try {
        await terminateMutation.mutateAsync({ workerId, reason, terminationDate: new Date().toISOString() });
        refetch();
        addNotification({ title: 'Employee terminated', message: 'The employee record has been terminated.', type: 'success', read: false });
      } catch (err) {
        addNotification({ title: 'Termination failed', message: err instanceof Error ? err.message : 'Could not terminate employee.', type: 'error', read: false });
      }
    }
  };

  const downloadCsv = async (url: string, filename: string) => {
    try {
      const response = await apiClient.get(url, { responseType: 'blob' });
      downloadBlob(response.data as Blob, filename);
    } catch (err) {
      addNotification({ title: 'Download failed', message: err instanceof Error ? err.message : 'Could not download file.', type: 'error', read: false });
    }
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const result = await massPreviewMutation.mutateAsync({ rows: parseSimpleCsv(await file.text()) });
      setUploadPreview(result);
      addNotification({
        title: result.accepted ? 'Upload validated' : 'Validation issues found',
        message: result.accepted ? `${result.rowCount} rows ready to import.` : `${result.errors.length} validation error(s) detected.`,
        type: result.accepted ? 'success' : 'warning',
        read: false,
      });
    } catch (err) {
      addNotification({ title: 'Upload failed', message: err instanceof Error ? err.message : 'Could not process the file.', type: 'error', read: false });
    }
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
            <Input className="hidden" type="file" accept=".csv,text/csv" aria-label="Upload employee CSV file" onChange={(event) => handleUpload(event.target.files?.[0])} />
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
            aria-label="Search employees"
            value={search}
            onChange={handleSearch}
            className="pl-9"
          />
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Employee Data Migration</h3>
            <p className="mt-1 text-sm text-slate-500">
              Upload CSV files using the downloadable template. Validation checks employee IDs, email uniqueness, salary, and currency before changes are accepted.
            </p>
          </div>
          <Badge variant={uploadPreview?.accepted ? 'default' : uploadPreview ? 'destructive' : 'secondary'}>
            {uploadPreview?.accepted ? 'Validated' : uploadPreview ? 'Needs correction' : 'Template ready'}
          </Badge>
        </div>
        <div className="mt-4 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="font-medium text-slate-900">Accepted file</p>
            <p className="mt-1">CSV only, comma separated, UTF-8 text.</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="font-medium text-slate-900">Required fields</p>
            <p className="mt-1">employeeId plus at least one editable employee field.</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="font-medium text-slate-900">Template columns</p>
            <p className="mt-1">name, email, phone, department, job title, work location, salary, currency.</p>
          </div>
        </div>
      </section>

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
        {isError ? (
          <ErrorState
            title="Unable to load employees"
            error={error}
            onRetry={() => refetch()}
          />
        ) : (
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
        )}
      </section>
    </div>
  );
}
