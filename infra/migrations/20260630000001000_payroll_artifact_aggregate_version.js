/**
 * PROD-2 fix: the command bus version-locks every aggregate by SELECTing
 * `aggregate_version` from its table (stepLoadAggregate). Four write-once payroll
 * artifact tables were registered as aggregates but never had the column, so the
 * version-lookup SELECT errored ("column aggregate_version does not exist"), poisoning
 * the command's transaction and silently breaking the entire payroll close -> payment
 * batch -> export path. Add the column (additive, default 0) so the lookup succeeds.
 */
const TABLES = [
  'payroll_payslip_artifacts',
  'payroll_payment_batches',
  'payroll_gl_postings',
  'payroll_export_jobs',
];

exports.up = (pgm) => {
  for (const name of TABLES) {
    pgm.addColumn(
      { schema: 'hr_payroll', name },
      { aggregate_version: { type: 'bigint', notNull: true, default: 0 } },
    );
  }
};

exports.down = (pgm) => {
  for (const name of TABLES) {
    pgm.dropColumn({ schema: 'hr_payroll', name }, 'aggregate_version');
  }
};
