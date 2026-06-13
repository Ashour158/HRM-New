exports.up = (pgm) => {
  pgm.createSchema('hr_scheduler', { ifNotExists: true });

  pgm.createTable({ schema: 'hr_scheduler', name: 'scheduler_jobs' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    job_key: { type: 'text', notNull: true },
    label: { type: 'text', notNull: true },
    description: { type: 'text' },
    job_type: { type: 'text', notNull: true },
    schedule_kind: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true, default: 'ACTIVE' },
    enabled: { type: 'boolean', notNull: true, default: true },
    command_name: { type: 'text' },
    aggregate_type: { type: 'text', notNull: true },
    aggregate_id: { type: 'uuid' },
    payload_template: { type: 'jsonb', notNull: true, default: '{}' },
    event_name: { type: 'text' },
    event_payload_template: { type: 'jsonb', notNull: true, default: '{}' },
    next_run_at: { type: 'timestamptz' },
    last_run_at: { type: 'timestamptz' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    { schema: 'hr_scheduler', name: 'scheduler_jobs' },
    'scheduler_jobs_tenant_job_key_unique',
    'UNIQUE (tenant_id, job_key)',
  );
  pgm.createIndex({ schema: 'hr_scheduler', name: 'scheduler_jobs' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_scheduler', name: 'scheduler_jobs' }, ['tenant_id', 'enabled', 'next_run_at']);

  pgm.createTable({ schema: 'hr_scheduler', name: 'scheduler_job_runs' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    job_id: { type: 'uuid', notNull: true },
    job_key: { type: 'text', notNull: true },
    period_key: { type: 'text', notNull: true },
    run_kind: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true, default: 'STARTED' },
    idempotency_key: { type: 'text', notNull: true },
    command_id: { type: 'uuid' },
    correlation_id: { type: 'uuid', notNull: true },
    event_id: { type: 'uuid' },
    started_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    finished_at: { type: 'timestamptz' },
    error_message: { type: 'text' },
    result_payload: { type: 'jsonb', notNull: true, default: '{}' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    { schema: 'hr_scheduler', name: 'scheduler_job_runs' },
    'scheduler_job_runs_job_fk',
    'FOREIGN KEY (job_id) REFERENCES hr_scheduler.scheduler_jobs(id) ON DELETE CASCADE',
  );
  pgm.addConstraint(
    { schema: 'hr_scheduler', name: 'scheduler_job_runs' },
    'scheduler_job_runs_tenant_job_period_unique',
    'UNIQUE (tenant_id, job_key, period_key)',
  );
  pgm.createIndex({ schema: 'hr_scheduler', name: 'scheduler_job_runs' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_scheduler', name: 'scheduler_job_runs' }, ['tenant_id', 'job_key', 'started_at']);
  pgm.createIndex({ schema: 'hr_scheduler', name: 'scheduler_job_runs' }, ['tenant_id', 'idempotency_key']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_scheduler', name: 'scheduler_job_runs' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_scheduler', name: 'scheduler_jobs' }, { cascade: true });
  pgm.dropSchema('hr_scheduler', { ifExists: true });
};
