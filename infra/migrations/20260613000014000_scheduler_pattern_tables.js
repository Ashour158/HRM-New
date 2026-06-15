exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_platform', name: 'reminder_dispatch_log' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'tenants' }, onDelete: 'CASCADE' },
    dispatch_key: { type: 'text', notNull: true },
    reminder_type: { type: 'text', notNull: true },
    subject_id: { type: 'uuid', notNull: true },
    subject_type: { type: 'text', notNull: true },
    due_date_bucket: { type: 'text', notNull: true },
    escalation_tier: { type: 'text', notNull: true },
    audience_worker_ids: { type: 'text[]', notNull: true, default: pgm.func("'{}'::text[]") },
    dispatched_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    expires_at: { type: 'timestamptz', notNull: true },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    { schema: 'hr_platform', name: 'reminder_dispatch_log' },
    'reminder_dispatch_log_tenant_dispatch_key_unique',
    'UNIQUE(tenant_id, dispatch_key)',
  );
  pgm.createIndex({ schema: 'hr_platform', name: 'reminder_dispatch_log' }, ['tenant_id', 'reminder_type', 'expires_at']);
  pgm.createIndex({ schema: 'hr_platform', name: 'reminder_dispatch_log' }, ['tenant_id', 'subject_type', 'subject_id']);

  pgm.createTable({ schema: 'hr_platform', name: 'effective_dating_activation_log' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'tenants' }, onDelete: 'CASCADE' },
    job_name: { type: 'text', notNull: true },
    aggregate_type: { type: 'text', notNull: true },
    aggregate_id: { type: 'uuid', notNull: true },
    effective_date_bucket: { type: 'text', notNull: true },
    command_name: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true },
    error: { type: 'text' },
    dispatched_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    finished_at: { type: 'timestamptz' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    { schema: 'hr_platform', name: 'effective_dating_activation_log' },
    'effective_dating_activation_log_status_check',
    "CHECK (status IN ('RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED'))",
  );
  pgm.addConstraint(
    { schema: 'hr_platform', name: 'effective_dating_activation_log' },
    'effective_dating_activation_log_unique',
    'UNIQUE(tenant_id, job_name, aggregate_type, aggregate_id, effective_date_bucket)',
  );
  pgm.createIndex({ schema: 'hr_platform', name: 'effective_dating_activation_log' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_platform', name: 'effective_dating_activation_log' }, ['tenant_id', 'job_name', 'dispatched_at']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_platform', name: 'effective_dating_activation_log' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_platform', name: 'reminder_dispatch_log' }, { cascade: true });
};
