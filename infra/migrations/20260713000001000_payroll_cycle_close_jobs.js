/**
 * Background-job run tracking for the payroll monthly close-to-pay pipeline.
 *
 * Modeled on the same status-lifecycle vocabulary as hr_platform.scheduler_job_runs
 * (RUNNING/SUCCEEDED/FAILED, started_at/finished_at) so operators reason about payroll
 * job runs the same way they reason about scheduled job runs, but kept as its own table
 * rather than bolted onto the shared cron-oriented scheduler tables because:
 *  - hr_scheduler.scheduler_job_runs requires a pre-registered SchedulerJob row (FK) and
 *    models a single command/event execution per run, not a multi-stage batch pipeline.
 *  - hr_platform.scheduler_job_runs is uniqued on (tenant_id, job_name, period_key), which
 *    is built for "did this recurring job already run for this period" gating - not for an
 *    on-demand HTTP-triggered run that must support legitimate re-runs of the same period
 *    (e.g. retrying close-to-pay after fixing a readiness blocker) and needs rich progress
 *    fields (X of Y employees, current batch, per-employee errors) that table doesn't have.
 */
exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_payroll', name: 'payroll_cycle_close_jobs' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    status: { type: 'text', notNull: true, default: 'RUNNING' },
    year: { type: 'integer', notNull: true },
    month: { type: 'integer', notNull: true },
    work_location_code: { type: 'text' },
    close_cycle: { type: 'boolean', notNull: true, default: true },
    batch_size: { type: 'integer', notNull: true, default: 50 },
    total_employees: { type: 'integer', notNull: true, default: 0 },
    processed_employees: { type: 'integer', notNull: true, default: 0 },
    total_batches: { type: 'integer', notNull: true, default: 0 },
    current_batch: { type: 'integer', notNull: true, default: 0 },
    payroll_cycle_id: { type: 'uuid' },
    payroll_calculation_run_id: { type: 'uuid' },
    errors: { type: 'jsonb', notNull: true, default: '[]' },
    error_message: { type: 'text' },
    result: { type: 'jsonb', notNull: true, default: '{}' },
    requested_by: { type: 'uuid' },
    started_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    finished_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    { schema: 'hr_payroll', name: 'payroll_cycle_close_jobs' },
    'payroll_cycle_close_jobs_status_check',
    "CHECK (status IN ('RUNNING', 'SUCCEEDED', 'FAILED'))",
  );
  pgm.createIndex({ schema: 'hr_payroll', name: 'payroll_cycle_close_jobs' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_payroll', name: 'payroll_cycle_close_jobs' }, ['tenant_id', 'started_at']);
  pgm.createIndex({ schema: 'hr_payroll', name: 'payroll_cycle_close_jobs' }, ['tenant_id', 'payroll_cycle_id']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_payroll', name: 'payroll_cycle_close_jobs' }, { cascade: true });
};
