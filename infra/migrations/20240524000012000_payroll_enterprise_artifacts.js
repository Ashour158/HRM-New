exports.up = (pgm) => {
  pgm.addColumns({ schema: 'hr_payroll', name: 'payroll_payment_batches' }, {
    bank_file_format: { type: 'text' },
    reconciliation_summary: { type: 'jsonb', notNull: true, default: '{}' },
    workflow_events: { type: 'jsonb', notNull: true, default: '[]' },
  });

  pgm.addColumns({ schema: 'hr_payroll', name: 'payroll_payslip_artifacts' }, {
    published_by: { type: 'uuid' },
  });

  pgm.createTable({ schema: 'hr_payroll', name: 'payroll_gl_postings' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    payroll_cycle_id: { type: 'uuid', notNull: true },
    posting_number: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true },
    total_debits: { type: 'numeric', notNull: true, default: 0 },
    total_credits: { type: 'numeric', notNull: true, default: 0 },
    currency: { type: 'char(3)', notNull: true },
    lines: { type: 'jsonb', notNull: true, default: '[]' },
    source_hash: { type: 'text', notNull: true },
    created_by: { type: 'uuid' },
    approved_by: { type: 'uuid' },
    posted_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint({ schema: 'hr_payroll', name: 'payroll_gl_postings' }, 'payroll_gl_postings_tenant_cycle_unique', {
    unique: ['tenant_id', 'payroll_cycle_id'],
  });
  pgm.createIndex({ schema: 'hr_payroll', name: 'payroll_gl_postings' }, ['tenant_id', 'status']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_payroll', name: 'payroll_gl_postings' }, { cascade: true });
  pgm.dropColumns({ schema: 'hr_payroll', name: 'payroll_payslip_artifacts' }, ['published_by']);
  pgm.dropColumns({ schema: 'hr_payroll', name: 'payroll_payment_batches' }, ['bank_file_format', 'reconciliation_summary', 'workflow_events']);
};
