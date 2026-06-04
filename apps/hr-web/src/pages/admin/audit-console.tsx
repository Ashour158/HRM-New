import * as React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, Radar, Search, ShieldCheck } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface AuditRecord {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  resourceType: string;
  resourceId: string;
  timestamp: string;
  details?: unknown;
}

function unwrapApiData<T>(response: { data: unknown }): T {
  const envelope = response.data as { data?: T; success?: boolean };
  if (envelope && typeof envelope === 'object' && envelope.success === true && 'data' in envelope) {
    return envelope.data as T;
  }
  return response.data as T;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function csvEscape(value: unknown) {
  const text = value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function AdminAuditConsole() {
  const [resourceType, setResourceType] = React.useState('');
  const [action, setAction] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [search, setSearch] = React.useState('');

  const auditQuery = useQuery({
    queryKey: ['admin-audit-console', resourceType, action, dateFrom, dateTo],
    queryFn: async () => unwrapApiData<AuditRecord[]>(await apiClient.get('/audit', {
      params: {
        resourceType: resourceType || undefined,
        action: action || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      },
    })),
  });

  const records = React.useMemo(() => {
    const value = search.trim().toLowerCase();
    const rows = auditQuery.data ?? [];
    if (!value) return rows;
    return rows.filter((record) => [
      record.action,
      record.resourceType,
      record.resourceId,
      record.actorId,
      record.actorName,
      JSON.stringify(record.details ?? {}),
    ].some((field) => field.toLowerCase().includes(value)));
  }, [auditQuery.data, search]);

  const exportCsv = () => {
    const header = ['timestamp', 'actor', 'action', 'resourceType', 'resourceId', 'details'];
    const body = records.map((record) => [
      record.timestamp,
      record.actorId || record.actorName,
      record.action,
      record.resourceType,
      record.resourceId,
      record.details ?? '',
    ].map(csvEscape).join(','));
    const blob = new Blob([[header.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-[#f8f9ff] p-6 text-[#0b1c30] md:p-8">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[#006c49] hover:underline" to="/admin/system-console">
              <ArrowLeft className="h-4 w-4" />
              Admin Panel
            </Link>
            <h1 className="font-['Hanken_Grotesk'] text-3xl font-bold md:text-4xl">Audit Trail</h1>
            <p className="mt-2 max-w-3xl text-sm text-[#3c4a42] md:text-base">
              Search, filter, export, and inspect administrative and service evidence from the platform audit ledger.
            </p>
          </div>
          <Button onClick={exportCsv} disabled={!records.length} className="gap-2 bg-[#006c49] text-white hover:bg-[#005236]">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="rounded-lg border-[#bbcabf]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Radar className="h-5 w-5 text-[#006c49]" />
                Records
              </CardTitle>
              <CardDescription>Filtered evidence rows</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{records.length}</CardContent>
          </Card>
          <Card className="rounded-lg border-[#bbcabf]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-5 w-5 text-[#4648d4]" />
                Scope
              </CardTitle>
              <CardDescription>Tenant-scoped and role-gated</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-[#3c4a42]">Audit, compliance, HR, payroll, and platform admins only</CardContent>
          </Card>
          <Card className="rounded-lg border-[#bbcabf]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Backend Source</CardTitle>
              <CardDescription>Live ledger endpoint</CardDescription>
            </CardHeader>
            <CardContent className="font-mono text-sm text-[#3c4a42]">GET /audit</CardContent>
          </Card>
        </section>

        <Card className="rounded-lg border-[#bbcabf]">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Use these controls for operator investigations, compliance evidence, and export packages.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-5">
            <input className="rounded-lg border border-[#bbcabf] bg-white px-3 py-2 text-sm" placeholder="Resource type" value={resourceType} onChange={(event) => setResourceType(event.target.value)} />
            <input className="rounded-lg border border-[#bbcabf] bg-white px-3 py-2 text-sm" placeholder="Action" value={action} onChange={(event) => setAction(event.target.value)} />
            <input className="rounded-lg border border-[#bbcabf] bg-white px-3 py-2 text-sm" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            <input className="rounded-lg border border-[#bbcabf] bg-white px-3 py-2 text-sm" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6c7a71]" />
              <input className="w-full rounded-lg border border-[#bbcabf] bg-white py-2 pl-9 pr-3 text-sm" placeholder="Search details" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-lg border-[#bbcabf]">
          <CardHeader>
            <CardTitle>Evidence Rows</CardTitle>
            <CardDescription>Newest rows are returned by the audit API, then narrowed by the filters above.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {auditQuery.isLoading ? (
              <div className="space-y-3 p-6">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#eff4ff]">
                      <TableHead>Time</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="whitespace-nowrap text-sm">{formatDate(record.timestamp)}</TableCell>
                        <TableCell className="font-mono text-xs">{record.actorId || record.actorName}</TableCell>
                        <TableCell className="font-semibold">{record.action}</TableCell>
                        <TableCell>
                          <div className="font-semibold">{record.resourceType}</div>
                          <div className="font-mono text-xs text-[#6c7a71]">{record.resourceId}</div>
                        </TableCell>
                        <TableCell className="max-w-md truncate font-mono text-xs text-[#3c4a42]">{JSON.stringify(record.details ?? {})}</TableCell>
                      </TableRow>
                    ))}
                    {!records.length && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-[#6c7a71]">No audit records match these filters.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
