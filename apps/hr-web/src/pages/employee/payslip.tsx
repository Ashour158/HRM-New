import * as React from 'react';
import { useApiQuery } from '@/hooks/use-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { Skeleton } from '@/components/ui/skeleton';
import { DataTable } from '@/components/common/data-table';
import { AllowedActions } from '@/components/common/allowed-actions';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Download, FileText, Eye, AlertTriangle } from 'lucide-react';
import type { Payslip } from '@/types';

/**
 * Payslip viewer with list and detail view.
 * HIGH_SENSITIVITY: audit-on-access is logged by backend.
 */
export function EmployeePayslip() {
  const [selectedPayslip, setSelectedPayslip] = React.useState<Payslip | null>(null);

  const { data: payslips, isLoading } = useApiQuery<Payslip[]>(
    ['employee-payslips'],
    '/employee/payslips'
  );

  const columns = [
    {
      key: 'period',
      header: 'Pay Period',
      cell: (row: Payslip) => (
        <span>
          {formatDate(row.payPeriodStart)} - {formatDate(row.payPeriodEnd)}
        </span>
      ),
    },
    {
      key: 'payDate',
      header: 'Pay Date',
      cell: (row: Payslip) => formatDate(row.payDate),
    },
    {
      key: 'grossPay',
      header: 'Gross Pay',
      cell: (row: Payslip) => formatCurrency(row.grossPay, row.currency),
    },
    {
      key: 'netPay',
      header: 'Net Pay',
      cell: (row: Payslip) => (
        <span className="font-medium">{formatCurrency(row.netPay, row.currency)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row: Payslip) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedPayslip(row)} aria-label="View payslip">
            <Eye className="h-4 w-4" />
          </Button>
          {row.pdfUrl && (
            <Button variant="ghost" size="sm" asChild aria-label="Download PDF">
              <a href={row.pdfUrl} download>
                <Download className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="fusion-gradient-text text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-indigo-500" />
            Payroll
          </h2>
          <p className="text-slate-500">View and download your payslips</p>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="text-xs text-slate-500">Sensitive data - access logged</span>
        </div>
      </div>

      {/* Sensitivity Warning */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:bg-amber-950/30 dark:border-amber-900">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">High Sensitivity Data</p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              All payslip access is audited and logged for compliance purposes.
            </p>
          </div>
        </div>
      </div>

      <div className="fusion-glass rounded-[2rem] p-5">
        <DataTable
          columns={columns}
          data={payslips ?? []}
          keyExtractor={(row) => row.id}
          emptyMessage="No payslips found"
        />
      </div>

      {/* Payslip Detail Modal */}
      {selectedPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Payslip Detail</CardTitle>
                  <CardDescription>
                    Pay Period: {formatDate(selectedPayslip.payPeriodStart)} - {formatDate(selectedPayslip.payPeriodEnd)}
                  </CardDescription>
                </div>
                <AllowedActions
                  aggregateType="PAYSLIP"
                  aggregateId={selectedPayslip.id}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 p-4 text-white fusion-hover">
                  <p className="text-xs text-white/80">Gross Pay</p>
                  <p className="text-2xl font-extrabold">{formatCurrency(selectedPayslip.grossPay, selectedPayslip.currency)}</p>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 p-4 text-white fusion-hover">
                  <p className="text-xs text-white/80">Deductions</p>
                  <p className="text-2xl font-extrabold">
                    -{formatCurrency(selectedPayslip.deductions, selectedPayslip.currency)}
                  </p>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 p-4 text-white fusion-hover">
                  <p className="text-xs text-white/80">Net Pay</p>
                  <p className="text-2xl font-extrabold">{formatCurrency(selectedPayslip.netPay, selectedPayslip.currency)}</p>
                </div>
              </div>

              <div className="space-y-2">
                {(selectedPayslip.lines ?? []).map((line) => (
                  <div key={line.id} className="flex justify-between gap-4 py-2 border-b">
                    <div>
                      <span className="text-sm font-medium">{line.description}</span>
                      {line.explanation ? <p className="text-xs text-muted-foreground">{line.explanation}</p> : null}
                    </div>
                    <span className="text-sm font-medium">{formatCurrency(line.amount, line.currency)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm">Taxes</span>
                  <span className="text-sm font-medium">{formatCurrency(selectedPayslip.taxes, selectedPayslip.currency)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm">Net Pay</span>
                  <span className="text-sm font-bold">{formatCurrency(selectedPayslip.netPay, selectedPayslip.currency)}</span>
                </div>
              </div>

              {selectedPayslip.pdfUrl && (
                <Button asChild className="w-full">
                  <a href={selectedPayslip.pdfUrl} download>
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </a>
                </Button>
              )}

              <Button variant="outline" className="w-full" onClick={() => setSelectedPayslip(null)}>
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
