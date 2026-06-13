exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_platform', name: 'scheduler_job_runs' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'tenants' }, onDelete: 'CASCADE' },
    job_name: { type: 'text', notNull: true },
    period_key: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true },
    items_processed: { type: 'integer', notNull: true, default: 0 },
    error: { type: 'text' },
    started_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    finished_at: { type: 'timestamptz' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    { schema: 'hr_platform', name: 'scheduler_job_runs' },
    'scheduler_job_runs_status_check',
    "CHECK (status IN ('RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED'))",
  );
  pgm.addConstraint(
    { schema: 'hr_platform', name: 'scheduler_job_runs' },
    'scheduler_job_runs_tenant_job_period_unique',
    'UNIQUE(tenant_id, job_name, period_key)',
  );
  pgm.createIndex({ schema: 'hr_platform', name: 'scheduler_job_runs' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_platform', name: 'scheduler_job_runs' }, ['tenant_id', 'job_name', 'started_at']);

  pgm.createTable({ schema: 'hr_platform', name: 'scheduler_job_schedules' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'tenants' }, onDelete: 'CASCADE' },
    job_name: { type: 'text', notNull: true },
    cron: { type: 'text', notNull: true },
    enabled: { type: 'boolean', notNull: true, default: true },
    updated_by: { type: 'uuid' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    { schema: 'hr_platform', name: 'scheduler_job_schedules' },
    'scheduler_job_schedules_tenant_job_unique',
    'UNIQUE(tenant_id, job_name)',
  );
  pgm.createIndex({ schema: 'hr_platform', name: 'scheduler_job_schedules' }, ['tenant_id', 'enabled']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_platform', name: 'scheduler_job_schedules' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_platform', name: 'scheduler_job_runs' }, { cascade: true });
};
