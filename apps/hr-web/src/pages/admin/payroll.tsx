import * as React from 'react';
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { DataTable } from '@/components/common/data-table';
import { AllowedActions } from '@/components/common/allowed-actions';
import { formatDate, formatCurrency } from '@/lib/utils';
import { DollarSign, Download, CheckCircle2, FileText } from 'lucide-react';

interface PayrollCycle {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: 'DRAFT' | 'INPUT' | 'CALCULATED' | 'APPROVED' | 'EXPORTED';
  totalGross: number;
  totalNet: number;
  workerCount: number;
  currency: string;
}

interface PayrollDetail {
  id: string;
  cycle: PayrollCycle;
  inputs: Array<{ workerId: string; workerName: string; amount: number; type: string }>;
  calculations: Array<{ workerId: string; workerName: string; gross: number; deductions: number; net: number }>;
}

/**
 * Payroll admin page with cycles, calculations, and approval workflow.
 */
export function AdminPayroll() {
  const [selectedCycle, setSelectedCycle] = React.useState<PayrollCycle | null>(null);

  const { data: cycles, isLoading } = useApiQuery<PayrollCycle[]>(
    ['admin-payroll-cycles'],
    '/admin/payroll/cycles'
  );

  const { data: cycleDetail } = useApiQuery<PayrollDetail>(
    ['admin-payroll-detail', selectedCycle?.id],
    `/admin/payroll/cycles/${selectedCycle?.id}`,
    { enabled: !!selectedCycle }
  );

  const approveMutation = useApiMutation<void, string>(
    '/admin/payroll/approve',
    'post',
    [['admin-payroll-cycles']]
  );

  const exportMutation = useApiMutation<void, string>(
    '/admin/payroll/export',
    'post',
    [['admin-payroll-cycles']]
  );

  const cycleColumns = [
    { key: 'name', header: 'Cycle', cell: (row: PayrollCycle) => row.name },
    {
      key: 'period',
      header: 'Period',
      cell: (row: PayrollCycle) => (
        <span>
          {formatDate(row.periodStart)} - {formatDate(row.periodEnd)}
        </span>
      ),
    },
    { key: 'payDate', header: 'Pay Date', cell: (row: PayrollCycle) => formatDate(row.payDate) },
    {
      key: 'status',
      header: 'Status',
      cell: (row: PayrollCycle) => {
        const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
          DRAFT: 'outline',
          INPUT: 'secondary',
          CALCULATED: 'default',
          APPROVED: 'default',
          EXPORTED: 'default',
        };
        return <Badge variant={variants[row.status] || 'default'}>{row.status}</Badge>;
      },
    },
    {
      key: 'workers',
      header: 'Workers',
      cell: (row: PayrollCycle) => row.workerCount,
    },
    {
      key: 'totalNet',
      header: 'Total Net',
      cell: (row: PayrollCycle) => formatCurrency(row.totalNet, row.currency),
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row: PayrollCycle) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedCycle(row)} aria-label="View cycle">
            <FileText className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6" />
            Payroll
          </h2>
          <p className="text-muted-foreground">Manage payroll cycles and processing</p>
        </div>
        <AllowedActions
          aggregateType="PAYROLL"
          onAction={(action) => console.log('Payroll action:', action)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payroll Cycles</CardTitle>
          <CardDescription>All payroll cycles and their status</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={cycleColumns}
            data={cycles ?? []}
            keyExtractor={(row) => row.id}
            isLoading={isLoading}
            emptyMessage="No payroll cycles found"
          />
        </CardContent>
      </Card>

      {/* Cycle Detail */}
      {selectedCycle && cycleDetail && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">{selectedCycle.name} Details</CardTitle>
                <CardDescription>
                  Status: {selectedCycle.status} • {selectedCycle.workerCount} workers
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {selectedCycle.status === 'CALCULATED' && (
                  <Button
                    onClick={() => approveMutation.mutate(selectedCycle.id)}
                    disabled={approveMutation.isPending}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                )}
                {selectedCycle.status === 'APPROVED' && (
                  <Button
                    onClick={() => exportMutation.mutate(selectedCycle.id)}
                    disabled={exportMutation.isPending}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                )}
                <Button variant="outline" onClick={() => setSelectedCycle(null)}>
                  Close
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-muted p-4">
                <p className="text-xs text-muted-foreground">Total Gross</p>
                <p className="text-xl font-bold">{formatCurrency(selectedCycle.totalGross, selectedCycle.currency)}</p>
              </div>
              <div className="rounded-lg bg-muted p-4">
                <p className="text-xs text-muted-foreground">Total Net</p>
                <p className="text-xl font-bold">{formatCurrency(selectedCycle.totalNet, selectedCycle.currency)}</p>
              </div>
              <div className="rounded-lg bg-muted p-4">
                <p className="text-xs text-muted-foreground">Workers</p>
                <p className="text-xl font-bold">{selectedCycle.workerCount}</p>
              </div>
            </div>

            {cycleDetail.inputs.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Inputs</h4>
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-2 text-left">Worker</th>
                        <th className="px-4 py-2 text-left">Type</th>
                        <th className="px-4 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cycleDetail.inputs.map((input, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-4 py-2">{input.workerName}</td>
                          <td className="px-4 py-2">{input.type}</td>
                          <td className="px-4 py-2 text-right">{formatCurrency(input.amount, selectedCycle.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
