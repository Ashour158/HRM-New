/**
 * Adds the missing composite index backing
 * `PayrollResultLineRepository.findByCalculationRun` (filters on
 * tenant_id + calculation_run_id). The table already has
 * [tenant_id, payroll_cycle_id] and [tenant_id, worker_id], but calculation-run
 * lookups — used when reviewing/exporting a specific calculation run — had no
 * supporting index and degraded to a scan on large payroll runs.
 */
exports.up = (pgm) => {
  pgm.createIndex(
    { schema: 'hr_payroll', name: 'payroll_result_lines' },
    ['tenant_id', 'calculation_run_id'],
    { ifNotExists: true },
  );
};

exports.down = (pgm) => {
  pgm.dropIndex(
    { schema: 'hr_payroll', name: 'payroll_result_lines' },
    ['tenant_id', 'calculation_run_id'],
    { ifExists: true },
  );
};
