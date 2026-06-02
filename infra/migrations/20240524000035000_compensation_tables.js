exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_compensation', name: 'compensation_plans' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    name: { type: 'text', notNull: true },
    plan_type: { type: 'text', notNull: true },
    currency: { type: 'text', notNull: true },
    effective_from: { type: 'date' },
    effective_until: { type: 'date' },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_compensation', name: 'compensation_plans' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_compensation', name: 'compensation_plans' }, ['tenant_id', 'plan_type']);

  pgm.createTable({ schema: 'hr_compensation', name: 'compensation_bands' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    band_code: { type: 'text', notNull: true },
    job_level: { type: 'text', notNull: true },
    job_family: { type: 'text', notNull: true },
    min_salary: { type: 'numeric', notNull: true, default: 0 },
    mid_salary: { type: 'numeric', notNull: true, default: 0 },
    max_salary: { type: 'numeric', notNull: true, default: 0 },
    currency: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_compensation', name: 'compensation_bands' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_compensation', name: 'compensation_bands' }, ['tenant_id', 'job_family', 'job_level']);
  pgm.createIndex({ schema: 'hr_compensation', name: 'compensation_bands' }, ['tenant_id', 'band_code'], { unique: true });

  pgm.createTable({ schema: 'hr_compensation', name: 'compensation_changes' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    change_type: { type: 'text', notNull: true },
    old_amount: { type: 'numeric' },
    new_amount: { type: 'numeric', notNull: true },
    currency: { type: 'text', notNull: true },
    effective_date: { type: 'date', notNull: true },
    approved_by: { type: 'uuid' },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_compensation', name: 'compensation_changes' }, ['tenant_id', 'worker_id']);
  pgm.createIndex({ schema: 'hr_compensation', name: 'compensation_changes' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_compensation', name: 'compensation_changes' }, ['tenant_id', 'effective_date']);

  pgm.createTable({ schema: 'hr_compensation', name: 'bonus_cycles' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    cycle_name: { type: 'text', notNull: true },
    cycle_year: { type: 'integer', notNull: true },
    eligibility_date: { type: 'date', notNull: true },
    payment_date: { type: 'date', notNull: true },
    total_pool_amount: { type: 'numeric', notNull: true, default: 0 },
    currency: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_compensation', name: 'bonus_cycles' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_compensation', name: 'bonus_cycles' }, ['tenant_id', 'cycle_year']);

  pgm.createTable({ schema: 'hr_compensation', name: 'equity_grants' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    grant_type: { type: 'text', notNull: true },
    grant_date: { type: 'date', notNull: true },
    vesting_schedule: { type: 'jsonb', notNull: true, default: '[]' },
    total_units: { type: 'numeric', notNull: true, default: 0 },
    vested_units: { type: 'numeric', notNull: true, default: 0 },
    exercised_units: { type: 'numeric', notNull: true, default: 0 },
    strike_price: { type: 'numeric' },
    status: { type: 'text', notNull: true, default: 'GRANTED' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_compensation', name: 'equity_grants' }, ['tenant_id', 'worker_id']);
  pgm.createIndex({ schema: 'hr_compensation', name: 'equity_grants' }, ['tenant_id', 'status']);

  pgm.createTable({ schema: 'hr_compensation', name: 'variable_comp_plans' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    name: { type: 'text', notNull: true },
    plan_type: { type: 'text', notNull: true },
    target_percentage: { type: 'numeric', notNull: true, default: 0 },
    max_percentage: { type: 'numeric', notNull: true, default: 0 },
    currency: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_compensation', name: 'variable_comp_plans' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_compensation', name: 'variable_comp_plans' }, ['tenant_id', 'plan_type']);

  pgm.createTable({ schema: 'hr_compensation', name: 'pay_scales' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    scale_code: { type: 'text', notNull: true },
    grade: { type: 'text', notNull: true },
    steps: { type: 'jsonb', notNull: true, default: '[]' },
    currency: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_compensation', name: 'pay_scales' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_compensation', name: 'pay_scales' }, ['tenant_id', 'scale_code'], { unique: true });

  pgm.createTable({ schema: 'hr_compensation', name: 'total_compensation_statements' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    statement_year: { type: 'integer', notNull: true },
    base_salary: { type: 'numeric', notNull: true, default: 0 },
    bonus_amount: { type: 'numeric', notNull: true, default: 0 },
    equity_value: { type: 'numeric', notNull: true, default: 0 },
    benefits_value: { type: 'numeric', notNull: true, default: 0 },
    total_comp: { type: 'numeric', notNull: true, default: 0 },
    currency: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_compensation', name: 'total_compensation_statements' }, ['tenant_id', 'worker_id']);
  pgm.createIndex({ schema: 'hr_compensation', name: 'total_compensation_statements' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_compensation', name: 'total_compensation_statements' }, ['tenant_id', 'statement_year']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_compensation', name: 'total_compensation_statements' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_compensation', name: 'pay_scales' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_compensation', name: 'variable_comp_plans' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_compensation', name: 'equity_grants' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_compensation', name: 'bonus_cycles' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_compensation', name: 'compensation_changes' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_compensation', name: 'compensation_bands' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_compensation', name: 'compensation_plans' }, { cascade: true });
};
