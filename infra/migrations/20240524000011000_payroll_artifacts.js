exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_payroll', name: 'payroll_payment_batches' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    payroll_cycle_id: { type: 'uuid', notNull: true },
    batch_number: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true },
    period_start: { type: 'date', notNull: true },
    period_end: { type: 'date', notNull: true },
    pay_date: { type: 'date', notNull: true },
    currency: { type: 'char(3)', notNull: true },
    ready_count: { type: 'integer', notNull: true, default: 0 },
    blocked_count: { type: 'integer', notNull: true, default: 0 },
    total_net: { type: 'numeric', notNull: true, default: 0 },
    file_hash: { type: 'text', notNull: true },
    payload: { type: 'jsonb', notNull: true, default: '{}' },
    created_by: { type: 'uuid' },
    approved_by: { type: 'uuid' },
    approved_at: { type: 'timestamptz' },
    exported_at: { type: 'timestamptz' },
    reconciled_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint({ schema: 'hr_payroll', name: 'payroll_payment_batches' }, 'payroll_payment_batches_tenant_cycle_unique', {
    unique: ['tenant_id', 'payroll_cycle_id'],
  });
  pgm.createIndex({ schema: 'hr_payroll', name: 'payroll_payment_batches' }, ['tenant_id', 'status']);

  pgm.createTable({ schema: 'hr_payroll', name: 'payroll_payslip_artifacts' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    payroll_cycle_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    employee_id: { type: 'text', notNull: true },
    artifact_format: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true },
    gross_pay: { type: 'numeric', notNull: true, default: 0 },
    net_pay: { type: 'numeric', notNull: true, default: 0 },
    currency: { type: 'char(3)', notNull: true },
    content_hash: { type: 'text', notNull: true },
    html_content: { type: 'text', notNull: true },
    data_classification: { type: 'text', notNull: true, default: 'HIGH_SENSITIVITY' },
    published_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint({ schema: 'hr_payroll', name: 'payroll_payslip_artifacts' }, 'payroll_payslip_artifacts_tenant_cycle_worker_unique', {
    unique: ['tenant_id', 'payroll_cycle_id', 'worker_id'],
  });
  pgm.createIndex({ schema: 'hr_payroll', name: 'payroll_payslip_artifacts' }, ['tenant_id', 'employee_id']);

  pgm.createTable({ schema: 'hr_payroll', name: 'payroll_export_jobs' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    payroll_cycle_id: { type: 'uuid' },
    export_type: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true },
    requested_by: { type: 'uuid' },
    purpose: { type: 'text', notNull: true },
    filters: { type: 'jsonb', notNull: true, default: '{}' },
    row_count: { type: 'integer', notNull: true, default: 0 },
    file_name: { type: 'text', notNull: true },
    file_hash: { type: 'text', notNull: true },
    data_classification: { type: 'text', notNull: true, default: 'HIGH_SENSITIVITY' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    completed_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_payroll', name: 'payroll_export_jobs' }, ['tenant_id', 'payroll_cycle_id']);
  pgm.createIndex({ schema: 'hr_payroll', name: 'payroll_export_jobs' }, ['tenant_id', 'export_type']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_payroll', name: 'payroll_export_jobs' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_payroll', name: 'payroll_payslip_artifacts' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_payroll', name: 'payroll_payment_batches' }, { cascade: true });
};
