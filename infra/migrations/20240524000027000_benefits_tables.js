exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_benefits', name: 'benefits_programs' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    program_name: { type: 'text', notNull: true },
    program_type: { type: 'text', notNull: true },
    carrier_id: { type: 'uuid' },
    effective_from: { type: 'date' },
    effective_until: { type: 'date' },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_benefits', name: 'benefits_programs' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_benefits', name: 'benefits_programs' }, ['tenant_id', 'program_type']);

  pgm.createTable({ schema: 'hr_benefits', name: 'benefits_enrollments' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    program_id: { type: 'uuid', notNull: true },
    coverage_level: { type: 'text', notNull: true },
    dependents: { type: 'jsonb', notNull: true, default: '[]' },
    effective_date: { type: 'date', notNull: true },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_benefits', name: 'benefits_enrollments' }, ['tenant_id', 'worker_id']);
  pgm.createIndex({ schema: 'hr_benefits', name: 'benefits_enrollments' }, ['tenant_id', 'program_id']);
  pgm.addConstraint(
    { schema: 'hr_benefits', name: 'benefits_enrollments' },
    'benefits_enrollments_program_fk',
    'FOREIGN KEY (program_id) REFERENCES hr_benefits.benefits_programs(id) ON DELETE CASCADE',
  );

  pgm.createTable({ schema: 'hr_benefits', name: 'benefits_life_events' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    event_type: { type: 'text', notNull: true },
    event_date: { type: 'date', notNull: true },
    description: { type: 'text' },
    status: { type: 'text', notNull: true, default: 'RECORDED' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_benefits', name: 'benefits_life_events' }, ['tenant_id', 'worker_id']);
  pgm.createIndex({ schema: 'hr_benefits', name: 'benefits_life_events' }, ['tenant_id', 'status']);

  pgm.createTable({ schema: 'hr_benefits', name: 'spending_accounts' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    account_type: { type: 'text', notNull: true },
    annual_election: { type: 'numeric', notNull: true, default: 0 },
    used_amount: { type: 'numeric', notNull: true, default: 0 },
    available_amount: { type: 'numeric', notNull: true, default: 0 },
    currency: { type: 'char(3)', notNull: true, default: 'USD' },
    status: { type: 'text', notNull: true, default: 'ACTIVE' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_benefits', name: 'spending_accounts' }, ['tenant_id', 'worker_id']);

  pgm.createTable({ schema: 'hr_benefits', name: 'carrier_reconciliation_runs' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    carrier_id: { type: 'uuid', notNull: true },
    period_start: { type: 'date', notNull: true },
    period_end: { type: 'date', notNull: true },
    total_premium: { type: 'numeric', notNull: true, default: 0 },
    total_collected: { type: 'numeric', notNull: true, default: 0 },
    variance_amount: { type: 'numeric', notNull: true, default: 0 },
    currency: { type: 'char(3)', notNull: true, default: 'USD' },
    status: { type: 'text', notNull: true, default: 'PENDING' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_benefits', name: 'carrier_reconciliation_runs' }, ['tenant_id', 'carrier_id']);
  pgm.createIndex({ schema: 'hr_benefits', name: 'carrier_reconciliation_runs' }, ['tenant_id', 'status']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_benefits', name: 'carrier_reconciliation_runs' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_benefits', name: 'spending_accounts' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_benefits', name: 'benefits_life_events' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_benefits', name: 'benefits_enrollments' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_benefits', name: 'benefits_programs' }, { cascade: true });
};
