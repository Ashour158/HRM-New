exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_wfm', name: 'shift_schedules' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    shift_date: { type: 'date', notNull: true },
    start_time: { type: 'timestamptz', notNull: true },
    end_time: { type: 'timestamptz', notNull: true },
    break_duration: { type: 'integer', notNull: true, default: 0 },
    department_id: { type: 'uuid', notNull: true },
    workplace_code: { type: 'text' },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_wfm', name: 'shift_schedules' }, ['tenant_id', 'worker_id', 'shift_date']);
  pgm.createIndex({ schema: 'hr_wfm', name: 'shift_schedules' }, ['tenant_id', 'department_id', 'shift_date']);
  pgm.createIndex({ schema: 'hr_wfm', name: 'shift_schedules' }, ['tenant_id', 'workplace_code', 'shift_date']);
  pgm.createIndex({ schema: 'hr_wfm', name: 'shift_schedules' }, ['tenant_id', 'status']);

  pgm.createTable({ schema: 'hr_wfm', name: 'open_shifts' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    department_id: { type: 'uuid', notNull: true },
    workplace_code: { type: 'text' },
    shift_date: { type: 'date', notNull: true },
    start_time: { type: 'timestamptz', notNull: true },
    end_time: { type: 'timestamptz', notNull: true },
    required_skills: { type: 'jsonb', notNull: true, default: '[]' },
    bid_deadline: { type: 'timestamptz' },
    filled_by_worker_id: { type: 'uuid' },
    status: { type: 'text', notNull: true, default: 'OPEN' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_wfm', name: 'open_shifts' }, ['tenant_id', 'department_id', 'shift_date']);
  pgm.createIndex({ schema: 'hr_wfm', name: 'open_shifts' }, ['tenant_id', 'workplace_code', 'shift_date']);
  pgm.createIndex({ schema: 'hr_wfm', name: 'open_shifts' }, ['tenant_id', 'status']);

  pgm.createTable({ schema: 'hr_wfm', name: 'shift_bids' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    open_shift_id: { type: 'uuid', notNull: true },
    bid_date: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    approved_by: { type: 'uuid' },
    approved_at: { type: 'timestamptz' },
    status: { type: 'text', notNull: true, default: 'SUBMITTED' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_wfm', name: 'shift_bids' }, ['tenant_id', 'worker_id']);
  pgm.createIndex({ schema: 'hr_wfm', name: 'shift_bids' }, ['tenant_id', 'open_shift_id']);
  pgm.createIndex({ schema: 'hr_wfm', name: 'shift_bids' }, ['tenant_id', 'status']);

  pgm.createTable({ schema: 'hr_wfm', name: 'shift_swap_requests' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    requester_worker_id: { type: 'uuid', notNull: true },
    target_worker_id: { type: 'uuid', notNull: true },
    original_shift_id: { type: 'uuid', notNull: true },
    target_shift_id: { type: 'uuid', notNull: true },
    reason: { type: 'text' },
    approved_by: { type: 'uuid' },
    status: { type: 'text', notNull: true, default: 'REQUESTED' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_wfm', name: 'shift_swap_requests' }, ['tenant_id', 'requester_worker_id']);
  pgm.createIndex({ schema: 'hr_wfm', name: 'shift_swap_requests' }, ['tenant_id', 'target_worker_id']);
  pgm.createIndex({ schema: 'hr_wfm', name: 'shift_swap_requests' }, ['tenant_id', 'status']);

  pgm.createTable({ schema: 'hr_wfm', name: 'wfm_overtime_approvals' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    requested_hours: { type: 'numeric', notNull: true },
    reason: { type: 'text', notNull: true },
    shift_date: { type: 'date' },
    requested_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    approved_by: { type: 'uuid' },
    approved_at: { type: 'timestamptz' },
    status: { type: 'text', notNull: true, default: 'REQUESTED' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_wfm', name: 'wfm_overtime_approvals' }, ['tenant_id', 'worker_id']);
  pgm.createIndex({ schema: 'hr_wfm', name: 'wfm_overtime_approvals' }, ['tenant_id', 'shift_date']);
  pgm.createIndex({ schema: 'hr_wfm', name: 'wfm_overtime_approvals' }, ['tenant_id', 'status']);

  pgm.createTable({ schema: 'hr_wfm', name: 'coverage_gaps' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    department_id: { type: 'uuid', notNull: true },
    workplace_code: { type: 'text' },
    shift_date: { type: 'date', notNull: true },
    gap_start: { type: 'timestamptz', notNull: true },
    gap_end: { type: 'timestamptz', notNull: true },
    required_skills: { type: 'jsonb', notNull: true, default: '[]' },
    unfilled_positions: { type: 'integer', notNull: true, default: 1 },
    filled_by_worker_id: { type: 'uuid' },
    status: { type: 'text', notNull: true, default: 'DETECTED' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_wfm', name: 'coverage_gaps' }, ['tenant_id', 'department_id', 'shift_date']);
  pgm.createIndex({ schema: 'hr_wfm', name: 'coverage_gaps' }, ['tenant_id', 'workplace_code', 'shift_date']);
  pgm.createIndex({ schema: 'hr_wfm', name: 'coverage_gaps' }, ['tenant_id', 'status']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_wfm', name: 'coverage_gaps' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_wfm', name: 'wfm_overtime_approvals' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_wfm', name: 'shift_swap_requests' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_wfm', name: 'shift_bids' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_wfm', name: 'open_shifts' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_wfm', name: 'shift_schedules' }, { cascade: true });
};
