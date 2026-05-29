exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_time', name: 'work_schedules' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    schedule_type: { type: 'text', notNull: true },
    start_date: { type: 'date', notNull: true },
    end_date: { type: 'date' },
    days_of_week: { type: 'jsonb' },
    hours_per_day: { type: 'numeric', notNull: true, default: 8 },
    timezone: { type: 'text', notNull: true, default: 'Africa/Cairo' },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_time', name: 'work_schedules' }, ['tenant_id', 'worker_id']);

  pgm.createTable({ schema: 'hr_time', name: 'timesheets' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    period_start: { type: 'date', notNull: true },
    period_end: { type: 'date', notNull: true },
    entries: { type: 'jsonb', notNull: true, default: '[]' },
    total_hours: { type: 'numeric', notNull: true, default: 0 },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    submitted_at: { type: 'timestamptz' },
    approved_by: { type: 'uuid' },
    approved_at: { type: 'timestamptz' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_time', name: 'timesheets' }, ['tenant_id', 'worker_id']);
  pgm.createIndex({ schema: 'hr_time', name: 'timesheets' }, ['tenant_id', 'period_start', 'period_end']);

  pgm.createTable({ schema: 'hr_time', name: 'time_clock_events' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    event_type: { type: 'text', notNull: true },
    timestamp: { type: 'timestamptz', notNull: true },
    location: { type: 'text' },
    device_id: { type: 'text' },
    status: { type: 'text', notNull: true, default: 'RECORDED' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_time', name: 'time_clock_events' }, ['tenant_id', 'worker_id', 'timestamp']);

  pgm.createTable({ schema: 'hr_time', name: 'attendance_exceptions' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    exception_type: { type: 'text', notNull: true },
    description: { type: 'text', notNull: true },
    detected_at: { type: 'timestamptz', notNull: true },
    resolved_at: { type: 'timestamptz' },
    resolved_by: { type: 'uuid' },
    status: { type: 'text', notNull: true, default: 'OPEN' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_time', name: 'attendance_exceptions' }, ['tenant_id', 'worker_id', 'status']);

  pgm.createTable({ schema: 'hr_time', name: 'overtime_approvals' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    requested_hours: { type: 'numeric', notNull: true },
    reason: { type: 'text', notNull: true },
    requested_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    approved_by: { type: 'uuid' },
    approved_at: { type: 'timestamptz' },
    status: { type: 'text', notNull: true, default: 'REQUESTED' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_time', name: 'overtime_approvals' }, ['tenant_id', 'worker_id', 'status']);

  pgm.createTable({ schema: 'hr_payroll', name: 'payroll_cycles' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    cycle_name: { type: 'text', notNull: true },
    pay_period_start: { type: 'date', notNull: true },
    pay_period_end: { type: 'date', notNull: true },
    pay_date: { type: 'date' },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    opened_at: { type: 'timestamptz' },
    closed_at: { type: 'timestamptz' },
    approved_by: { type: 'uuid' },
    approved_at: { type: 'timestamptz' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_payroll', name: 'payroll_cycles' }, ['tenant_id', 'pay_period_start', 'pay_period_end']);

  pgm.createTable({ schema: 'hr_payroll', name: 'payroll_inputs' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    payroll_cycle_id: { type: 'uuid', notNull: true },
    input_type: { type: 'text', notNull: true },
    amount: { type: 'numeric', notNull: true },
    currency: { type: 'char(3)', notNull: true },
    description: { type: 'text' },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_payroll', name: 'payroll_inputs' }, ['tenant_id', 'payroll_cycle_id']);
  pgm.createIndex({ schema: 'hr_payroll', name: 'payroll_inputs' }, ['tenant_id', 'worker_id']);

  pgm.createTable({ schema: 'hr_payroll', name: 'payroll_calculation_runs' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    payroll_cycle_id: { type: 'uuid', notNull: true },
    started_at: { type: 'timestamptz' },
    completed_at: { type: 'timestamptz' },
    total_workers: { type: 'integer', notNull: true, default: 0 },
    total_gross_pay: { type: 'numeric', notNull: true, default: 0 },
    total_net_pay: { type: 'numeric', notNull: true, default: 0 },
    currency: { type: 'char(3)', notNull: true },
    status: { type: 'text', notNull: true, default: 'STARTED' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_payroll', name: 'payroll_calculation_runs' }, ['tenant_id', 'payroll_cycle_id']);

  pgm.createTable({ schema: 'hr_payroll', name: 'payroll_result_lines' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    payroll_cycle_id: { type: 'uuid', notNull: true },
    calculation_run_id: { type: 'uuid', notNull: true },
    line_type: { type: 'text', notNull: true },
    description: { type: 'text', notNull: true },
    amount: { type: 'numeric', notNull: true },
    currency: { type: 'char(3)', notNull: true },
    rule_set_id: { type: 'text' },
    rule_id: { type: 'text' },
    explanation: { type: 'text' },
    status: { type: 'text', notNull: true, default: 'CALCULATED' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_payroll', name: 'payroll_result_lines' }, ['tenant_id', 'payroll_cycle_id']);
  pgm.createIndex({ schema: 'hr_payroll', name: 'payroll_result_lines' }, ['tenant_id', 'worker_id']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_payroll', name: 'payroll_result_lines' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_payroll', name: 'payroll_calculation_runs' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_payroll', name: 'payroll_inputs' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_payroll', name: 'payroll_cycles' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_time', name: 'overtime_approvals' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_time', name: 'attendance_exceptions' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_time', name: 'time_clock_events' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_time', name: 'timesheets' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_time', name: 'work_schedules' }, { cascade: true });
};
