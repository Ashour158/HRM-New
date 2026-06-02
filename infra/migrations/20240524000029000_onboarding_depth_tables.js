exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_onboarding', name: 'onboarding_plans' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'tenants' } },
    worker_id: { type: 'uuid', notNull: true },
    start_date: { type: 'date', notNull: true },
    assigned_buddy_id: { type: 'uuid' },
    mentor_id: { type: 'uuid' },
    role_track: { type: 'text' },
    preboarding_portal_status: { type: 'text', notNull: true, default: 'NOT_INVITED' },
    first_day_instructions: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    welcome_message: { type: 'text' },
    probation_review_date: { type: 'date' },
    probation_status: { type: 'text', notNull: true, default: 'NOT_REQUIRED' },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint({ schema: 'hr_onboarding', name: 'onboarding_plans' }, 'onboarding_plans_status_check', "CHECK (status IN ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'))");
  pgm.addConstraint({ schema: 'hr_onboarding', name: 'onboarding_plans' }, 'onboarding_plans_portal_status_check', "CHECK (preboarding_portal_status IN ('NOT_INVITED', 'INVITED', 'ACTIVE', 'COMPLETED'))");
  pgm.addConstraint({ schema: 'hr_onboarding', name: 'onboarding_plans' }, 'onboarding_plans_probation_status_check', "CHECK (probation_status IN ('NOT_REQUIRED', 'PENDING_REVIEW', 'CONFIRMED', 'EXTENDED', 'TERMINATION_RECOMMENDED'))");
  pgm.createIndex({ schema: 'hr_onboarding', name: 'onboarding_plans' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_onboarding', name: 'onboarding_plans' }, ['tenant_id', 'worker_id']);

  pgm.createTable({ schema: 'hr_onboarding', name: 'onboarding_tasks' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'tenants' } },
    onboarding_plan_id: { type: 'uuid', notNull: true, references: { schema: 'hr_onboarding', name: 'onboarding_plans' }, onDelete: 'cascade' },
    title: { type: 'text', notNull: true },
    description: { type: 'text' },
    assigned_to: { type: 'uuid' },
    owner_group: { type: 'text', notNull: true, default: 'HR' },
    category: { type: 'text', notNull: true, default: 'PREBOARDING' },
    required: { type: 'boolean', notNull: true, default: true },
    evidence_type: { type: 'text' },
    evidence_payload: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    provisioning_target: { type: 'text' },
    signing_provider_envelope_id: { type: 'text' },
    milestone_day: { type: 'integer' },
    completion_notes: { type: 'text' },
    due_date: { type: 'timestamptz' },
    completed_at: { type: 'timestamptz' },
    status: { type: 'text', notNull: true, default: 'PENDING' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint({ schema: 'hr_onboarding', name: 'onboarding_tasks' }, 'onboarding_tasks_status_check', "CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'SKIPPED'))");
  pgm.addConstraint({ schema: 'hr_onboarding', name: 'onboarding_tasks' }, 'onboarding_tasks_owner_group_check', "CHECK (owner_group IN ('HR', 'IT', 'FINANCE', 'ADMIN', 'MANAGER', 'SECURITY', 'FACILITIES', 'EMPLOYEE', 'BUDDY', 'COMPLIANCE'))");
  pgm.createIndex({ schema: 'hr_onboarding', name: 'onboarding_tasks' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_onboarding', name: 'onboarding_tasks' }, ['onboarding_plan_id', 'owner_group']);
  pgm.createIndex({ schema: 'hr_onboarding', name: 'onboarding_tasks' }, ['assigned_to', 'status']);

  pgm.createTable({ schema: 'hr_onboarding', name: 'onboarding_track_templates' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'tenants' } },
    code: { type: 'text', notNull: true },
    name: { type: 'text', notNull: true },
    role_track: { type: 'text', notNull: true },
    target_employment_types: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    country_codes: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    task_blueprint: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint({ schema: 'hr_onboarding', name: 'onboarding_track_templates' }, 'onboarding_track_templates_code_unique', 'UNIQUE(tenant_id, code)');
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_onboarding', name: 'onboarding_track_templates' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_onboarding', name: 'onboarding_tasks' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_onboarding', name: 'onboarding_plans' }, { cascade: true });
};
