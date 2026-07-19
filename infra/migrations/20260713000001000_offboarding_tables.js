exports.up = (pgm) => {
  pgm.createSchema('hr_offboarding', { ifNotExists: true });

  pgm.createTable({ schema: 'hr_offboarding', name: 'offboarding_plans' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'tenants' } },
    worker_id: { type: 'uuid', notNull: true },
    last_working_day: { type: 'date', notNull: true },
    initiated_by: { type: 'uuid', notNull: true },
    reason_category: { type: 'text', notNull: true, default: 'OTHER' },
    reason_notes: { type: 'text' },
    manager_id: { type: 'uuid' },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint({ schema: 'hr_offboarding', name: 'offboarding_plans' }, 'offboarding_plans_status_check', "CHECK (status IN ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'))");
  pgm.addConstraint({ schema: 'hr_offboarding', name: 'offboarding_plans' }, 'offboarding_plans_reason_category_check', "CHECK (reason_category IN ('RESIGNATION', 'INVOLUNTARY_TERMINATION', 'LAYOFF_REDUNDANCY', 'RETIREMENT', 'END_OF_CONTRACT', 'MUTUAL_AGREEMENT', 'OTHER'))");
  pgm.createIndex({ schema: 'hr_offboarding', name: 'offboarding_plans' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_offboarding', name: 'offboarding_plans' }, ['tenant_id', 'worker_id']);

  pgm.createTable({ schema: 'hr_offboarding', name: 'offboarding_tasks' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'tenants' } },
    offboarding_plan_id: { type: 'uuid', notNull: true, references: { schema: 'hr_offboarding', name: 'offboarding_plans' }, onDelete: 'cascade' },
    title: { type: 'text', notNull: true },
    description: { type: 'text' },
    assigned_to: { type: 'uuid' },
    owner_group: { type: 'text', notNull: true, default: 'HR' },
    category: { type: 'text', notNull: true, default: 'EXIT_CHECKLIST' },
    required: { type: 'boolean', notNull: true, default: true },
    evidence_type: { type: 'text' },
    evidence_payload: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    completion_notes: { type: 'text' },
    due_date: { type: 'timestamptz' },
    completed_at: { type: 'timestamptz' },
    status: { type: 'text', notNull: true, default: 'PENDING' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint({ schema: 'hr_offboarding', name: 'offboarding_tasks' }, 'offboarding_tasks_status_check', "CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'SKIPPED'))");
  pgm.addConstraint({ schema: 'hr_offboarding', name: 'offboarding_tasks' }, 'offboarding_tasks_owner_group_check', "CHECK (owner_group IN ('HR', 'IT', 'FINANCE', 'MANAGER', 'SECURITY', 'FACILITIES', 'EMPLOYEE'))");
  pgm.addConstraint({ schema: 'hr_offboarding', name: 'offboarding_tasks' }, 'offboarding_tasks_category_check', "CHECK (category IN ('EXIT_CHECKLIST', 'KNOWLEDGE_TRANSFER', 'ASSET_RETURN', 'ACCESS_REVOCATION_CONFIRMATION', 'FINAL_SETTLEMENT_CONFIRMATION', 'EXIT_INTERVIEW', 'DOCUMENT', 'COMPLIANCE'))");
  pgm.createIndex({ schema: 'hr_offboarding', name: 'offboarding_tasks' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_offboarding', name: 'offboarding_tasks' }, ['offboarding_plan_id', 'owner_group']);
  pgm.createIndex({ schema: 'hr_offboarding', name: 'offboarding_tasks' }, ['assigned_to', 'status']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_offboarding', name: 'offboarding_tasks' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_offboarding', name: 'offboarding_plans' }, { cascade: true });
  pgm.dropSchema('hr_offboarding', { ifExists: true, cascade: true });
};
