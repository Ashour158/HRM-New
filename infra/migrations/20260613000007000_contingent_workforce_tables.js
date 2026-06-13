exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_contingent', name: 'sow_engagements' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    sow_number: { type: 'text', notNull: true },
    vendor_id: { type: 'uuid', notNull: true },
    project_name: { type: 'text', notNull: true },
    total_value: { type: 'numeric', notNull: true, default: 0 },
    currency: { type: 'text', notNull: true },
    start_date: { type: 'timestamptz', notNull: true },
    end_date: { type: 'timestamptz', notNull: true },
    milestones: { type: 'jsonb' },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_contingent', name: 'sow_engagements' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_contingent', name: 'sow_engagements' }, ['tenant_id', 'vendor_id']);
  pgm.createIndex({ schema: 'hr_contingent', name: 'sow_engagements' }, ['tenant_id', 'sow_number']);

  pgm.createTable({ schema: 'hr_contingent', name: 'contingent_worker_assignments' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    vendor_id: { type: 'uuid', notNull: true },
    project_id: { type: 'uuid', notNull: true },
    start_date: { type: 'timestamptz', notNull: true },
    end_date: { type: 'timestamptz', notNull: true },
    rate: { type: 'numeric', notNull: true, default: 0 },
    currency: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_contingent', name: 'contingent_worker_assignments' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_contingent', name: 'contingent_worker_assignments' }, ['tenant_id', 'worker_id']);
  pgm.createIndex({ schema: 'hr_contingent', name: 'contingent_worker_assignments' }, ['tenant_id', 'vendor_id']);
  pgm.createIndex({ schema: 'hr_contingent', name: 'contingent_worker_assignments' }, ['tenant_id', 'project_id']);

  pgm.createTable({ schema: 'hr_contingent', name: 'contractor_rate_cards' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    vendor_id: { type: 'uuid', notNull: true },
    job_title: { type: 'text', notNull: true },
    rate: { type: 'numeric', notNull: true, default: 0 },
    currency: { type: 'text', notNull: true },
    effective_from: { type: 'timestamptz', notNull: true },
    effective_until: { type: 'timestamptz' },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_contingent', name: 'contractor_rate_cards' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_contingent', name: 'contractor_rate_cards' }, ['tenant_id', 'vendor_id']);
  pgm.createIndex({ schema: 'hr_contingent', name: 'contractor_rate_cards' }, ['tenant_id', 'job_title']);

  pgm.createTable({ schema: 'hr_contingent', name: 'misclassification_assessments' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    assessment_date: { type: 'timestamptz', notNull: true },
    risk_score: { type: 'numeric' },
    risk_factors: { type: 'jsonb', notNull: true, default: '[]' },
    status: { type: 'text', notNull: true, default: 'PENDING' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_contingent', name: 'misclassification_assessments' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_contingent', name: 'misclassification_assessments' }, ['tenant_id', 'worker_id']);
  pgm.createIndex({ schema: 'hr_contingent', name: 'misclassification_assessments' }, ['tenant_id', 'assessment_date']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_contingent', name: 'misclassification_assessments' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_contingent', name: 'contractor_rate_cards' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_contingent', name: 'contingent_worker_assignments' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_contingent', name: 'sow_engagements' }, { cascade: true });
};
