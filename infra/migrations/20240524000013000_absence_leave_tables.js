exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_absence', name: 'absence_requests' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    absence_type: { type: 'text', notNull: true },
    start_date: { type: 'date', notNull: true },
    end_date: { type: 'date', notNull: true },
    reason: { type: 'text' },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    submitted_at: { type: 'timestamptz' },
    approved_by: { type: 'uuid' },
    approved_at: { type: 'timestamptz' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_absence', name: 'absence_requests' }, ['tenant_id', 'worker_id']);
  pgm.createIndex({ schema: 'hr_absence', name: 'absence_requests' }, ['tenant_id', 'status', 'start_date', 'end_date']);

  pgm.createTable({ schema: 'hr_absence', name: 'leave_cases' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    leave_type: { type: 'text', notNull: true },
    start_date: { type: 'date', notNull: true },
    expected_return_date: { type: 'date' },
    actual_return_date: { type: 'date' },
    status: { type: 'text', notNull: true, default: 'OPENED' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_absence', name: 'leave_cases' }, ['tenant_id', 'worker_id', 'status']);

  pgm.createTable({ schema: 'hr_absence', name: 'absence_accrual_balances' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    leave_type: { type: 'text', notNull: true },
    balance_hours: { type: 'numeric', notNull: true, default: 0 },
    accrued_hours: { type: 'numeric', notNull: true, default: 0 },
    used_hours: { type: 'numeric', notNull: true, default: 0 },
    carried_over_hours: { type: 'numeric', notNull: true, default: 0 },
    effective_date: { type: 'date', notNull: true },
    status: { type: 'text', notNull: true, default: 'ACTIVE' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_absence', name: 'absence_accrual_balances' }, ['tenant_id', 'worker_id', 'leave_type']);

  pgm.createTable({ schema: 'hr_absence', name: 'leave_entitlement_calculations' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    leave_type: { type: 'text', notNull: true },
    calculated_entitlement: { type: 'numeric', notNull: true, default: 0 },
    used_entitlement: { type: 'numeric', notNull: true, default: 0 },
    remaining_entitlement: { type: 'numeric', notNull: true, default: 0 },
    calculation_date: { type: 'date', notNull: true },
    status: { type: 'text', notNull: true, default: 'STARTED' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_absence', name: 'leave_entitlement_calculations' }, ['tenant_id', 'worker_id', 'leave_type']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_absence', name: 'leave_entitlement_calculations' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_absence', name: 'absence_accrual_balances' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_absence', name: 'leave_cases' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_absence', name: 'absence_requests' }, { cascade: true });
};
