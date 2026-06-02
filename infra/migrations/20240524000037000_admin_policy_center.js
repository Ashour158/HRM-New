exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_platform', name: 'admin_policy_revisions' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: {
      type: 'uuid',
      notNull: true,
      references: { schema: 'hr_platform', name: 'tenants' },
      onDelete: 'cascade',
    },
    area: { type: 'text', notNull: true },
    title: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    baseline_config: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    draft_config: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    validation_result: { type: 'jsonb' },
    simulation_result: { type: 'jsonb' },
    created_by: { type: 'text' },
    reviewed_by: { type: 'text' },
    approved_by: { type: 'text' },
    published_by: { type: 'text' },
    applied_by: { type: 'text' },
    review_notes: { type: 'text' },
    submitted_at: { type: 'timestamptz' },
    reviewed_at: { type: 'timestamptz' },
    approved_at: { type: 'timestamptz' },
    published_at: { type: 'timestamptz' },
    applied_at: { type: 'timestamptz' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint(
    { schema: 'hr_platform', name: 'admin_policy_revisions' },
    'admin_policy_revisions_area_check',
    "CHECK (area IN ('EMPLOYEE_SETUP', 'LEAVE', 'ATTENDANCE', 'PAYROLL', 'ACCESS_GOVERNANCE', 'COUNTRY_POLICY', 'COMPLIANCE'))",
  );
  pgm.addConstraint(
    { schema: 'hr_platform', name: 'admin_policy_revisions' },
    'admin_policy_revisions_status_check',
    "CHECK (status IN ('DRAFT', 'IN_REVIEW', 'REVIEWED', 'APPROVED', 'PUBLISHED', 'APPLIED', 'REJECTED', 'ARCHIVED'))",
  );
  pgm.createIndex({ schema: 'hr_platform', name: 'admin_policy_revisions' }, ['tenant_id', 'area', 'status']);
  pgm.createIndex({ schema: 'hr_platform', name: 'admin_policy_revisions' }, ['tenant_id', 'updated_at']);

  pgm.createTable({ schema: 'hr_platform', name: 'admin_policy_revision_scopes' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: {
      type: 'uuid',
      notNull: true,
      references: { schema: 'hr_platform', name: 'tenants' },
      onDelete: 'cascade',
    },
    revision_id: {
      type: 'uuid',
      notNull: true,
      references: { schema: 'hr_platform', name: 'admin_policy_revisions' },
      onDelete: 'cascade',
    },
    country_codes: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    legal_entity_ids: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    org_unit_ids: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    department_ids: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    location_codes: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    employee_types: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    worker_ids: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    effective_from: { type: 'date' },
    effective_until: { type: 'date' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    { schema: 'hr_platform', name: 'admin_policy_revision_scopes' },
    'admin_policy_revision_scopes_revision_unique',
    'UNIQUE(revision_id)',
  );
  pgm.createIndex({ schema: 'hr_platform', name: 'admin_policy_revision_scopes' }, ['tenant_id', 'effective_from', 'effective_until']);

  pgm.createTable({ schema: 'hr_platform', name: 'admin_policy_application_runs' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'tenants' }, onDelete: 'cascade' },
    revision_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'admin_policy_revisions' }, onDelete: 'cascade' },
    status: { type: 'text', notNull: true },
    impacted_employees: { type: 'integer', notNull: true, default: 0 },
    pending_records: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    applied_by: { type: 'text', notNull: true },
    applied_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    runtime_snapshot: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
  });
  pgm.addConstraint(
    { schema: 'hr_platform', name: 'admin_policy_application_runs' },
    'admin_policy_application_runs_status_check',
    "CHECK (status IN ('APPLIED', 'FAILED'))",
  );
  pgm.createIndex({ schema: 'hr_platform', name: 'admin_policy_application_runs' }, ['tenant_id', 'revision_id', 'applied_at']);

  pgm.createTable({ schema: 'hr_platform', name: 'admin_policy_impact_results' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'tenants' }, onDelete: 'cascade' },
    revision_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'admin_policy_revisions' }, onDelete: 'cascade' },
    simulation_result: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    created_by: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_platform', name: 'admin_policy_impact_results' }, ['tenant_id', 'revision_id', 'created_at']);

  pgm.createTable({ schema: 'hr_platform', name: 'admin_policy_decision_evidence' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'tenants' }, onDelete: 'cascade' },
    policy_revision_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'admin_policy_revisions' }, onDelete: 'cascade' },
    service_area: { type: 'text', notNull: true },
    engine_name: { type: 'text', notNull: true },
    engine_version: { type: 'text', notNull: true },
    scope_match: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    decision: { type: 'text', notNull: true },
    reason: { type: 'text', notNull: true },
    subject_worker_id: { type: 'uuid' },
    source_record_id: { type: 'uuid' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_platform', name: 'admin_policy_decision_evidence' }, ['tenant_id', 'policy_revision_id', 'created_at']);
  pgm.createIndex({ schema: 'hr_platform', name: 'admin_policy_decision_evidence' }, ['tenant_id', 'subject_worker_id', 'created_at']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_platform', name: 'admin_policy_decision_evidence' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_platform', name: 'admin_policy_impact_results' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_platform', name: 'admin_policy_application_runs' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_platform', name: 'admin_policy_revision_scopes' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_platform', name: 'admin_policy_revisions' }, { cascade: true });
};
