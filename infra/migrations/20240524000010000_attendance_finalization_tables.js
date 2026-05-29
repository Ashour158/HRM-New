exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_time', name: 'attendance_daily_ledgers' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    employee_id: { type: 'text', notNull: true },
    worker_name: { type: 'text', notNull: true },
    work_date: { type: 'date', notNull: true },
    status: { type: 'text', notNull: true },
    scheduled: { type: 'boolean', notNull: true, default: true },
    holiday_name: { type: 'text' },
    first_check_in_at: { type: 'timestamptz' },
    latest_check_out_at: { type: 'timestamptz' },
    location_status: { type: 'text', notNull: true },
    worked_minutes: { type: 'integer', notNull: true, default: 0 },
    payable_minutes: { type: 'integer', notNull: true, default: 0 },
    deduction_minutes: { type: 'integer', notNull: true, default: 0 },
    overtime_minutes: { type: 'integer', notNull: true, default: 0 },
    late_minutes: { type: 'integer', notNull: true, default: 0 },
    undertime_minutes: { type: 'integer', notNull: true, default: 0 },
    exception_count: { type: 'integer', notNull: true, default: 0 },
    ready_for_payroll: { type: 'boolean', notNull: true, default: false },
    locked: { type: 'boolean', notNull: true, default: false },
    locked_at: { type: 'timestamptz' },
    locked_by: { type: 'uuid' },
    payroll_cycle_id: { type: 'uuid' },
    source_hash: { type: 'text', notNull: true },
    ledger_payload: { type: 'jsonb', notNull: true, default: '{}' },
    payroll_payload: { type: 'jsonb', notNull: true, default: '{}' },
    governance: { type: 'jsonb', notNull: true, default: '{}' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint({ schema: 'hr_time', name: 'attendance_daily_ledgers' }, 'attendance_daily_ledgers_tenant_worker_date_unique', {
    unique: ['tenant_id', 'worker_id', 'work_date'],
  });
  pgm.createIndex({ schema: 'hr_time', name: 'attendance_daily_ledgers' }, ['tenant_id', 'work_date']);
  pgm.createIndex({ schema: 'hr_time', name: 'attendance_daily_ledgers' }, ['tenant_id', 'payroll_cycle_id']);

  pgm.createTable({ schema: 'hr_time', name: 'attendance_correction_requests' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    work_date: { type: 'date', notNull: true },
    correction_type: { type: 'text', notNull: true },
    requested_event_type: { type: 'text' },
    requested_timestamp: { type: 'timestamptz' },
    target_event_id: { type: 'uuid' },
    reason: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true, default: 'PENDING_MANAGER_REVIEW' },
    requested_by: { type: 'uuid', notNull: true },
    requested_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    reviewed_by: { type: 'uuid' },
    reviewed_at: { type: 'timestamptz' },
    applied_by: { type: 'uuid' },
    applied_at: { type: 'timestamptz' },
    applied_event_id: { type: 'uuid' },
    audit_trail: { type: 'jsonb', notNull: true, default: '[]' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_time', name: 'attendance_correction_requests' }, ['tenant_id', 'worker_id', 'work_date']);
  pgm.createIndex({ schema: 'hr_time', name: 'attendance_correction_requests' }, ['tenant_id', 'status']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_time', name: 'attendance_correction_requests' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_time', name: 'attendance_daily_ledgers' }, { cascade: true });
};
