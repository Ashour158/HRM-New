exports.up = (pgm) => {
  pgm.createSchema('hr_global_hr', { ifNotExists: true });

  pgm.createTable({ schema: 'hr_global_hr', name: 'country_rule_sets' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    country_code: { type: 'text', notNull: true },
    rule_set_type: { type: 'text', notNull: true },
    version: { type: 'integer', notNull: true, default: 1 },
    effective_from: { type: 'date' },
    effective_until: { type: 'date' },
    rules: { type: 'jsonb', notNull: true, default: '{}' },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_global_hr', name: 'country_rule_sets' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_global_hr', name: 'country_rule_sets' }, ['tenant_id', 'country_code']);

  pgm.createTable({ schema: 'hr_global_hr', name: 'statutory_leave_types' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    country_code: { type: 'text', notNull: true },
    leave_type_code: { type: 'text', notNull: true },
    leave_type_name: { type: 'text', notNull: true },
    minimum_entitlement: { type: 'numeric', notNull: true, default: 0 },
    unit: { type: 'text', notNull: true },
    carryover_allowed: { type: 'boolean', notNull: true, default: false },
    max_carryover: { type: 'numeric' },
    effective_from: { type: 'date' },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_global_hr', name: 'statutory_leave_types' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_global_hr', name: 'statutory_leave_types' }, ['tenant_id', 'country_code']);

  pgm.createTable({ schema: 'hr_global_hr', name: 'work_authorization_cases' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    authorization_type: { type: 'text', notNull: true },
    issuing_country: { type: 'text', notNull: true },
    document_number: { type: 'text' },
    valid_from: { type: 'date' },
    valid_until: { type: 'date' },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_global_hr', name: 'work_authorization_cases' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_global_hr', name: 'work_authorization_cases' }, ['tenant_id', 'worker_id']);
  pgm.createIndex({ schema: 'hr_global_hr', name: 'work_authorization_cases' }, ['tenant_id', 'valid_until']);

  pgm.createTable({ schema: 'hr_global_hr', name: 'works_council_consultations' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    country_code: { type: 'text', notNull: true },
    legal_entity_id: { type: 'uuid', notNull: true },
    action_type: { type: 'text', notNull: true },
    consultation_type: { type: 'text', notNull: true },
    initiated_at: { type: 'timestamptz' },
    deadline_date: { type: 'date' },
    completed_at: { type: 'timestamptz' },
    blocking_until: { type: 'timestamptz' },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_global_hr', name: 'works_council_consultations' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_global_hr', name: 'works_council_consultations' }, ['tenant_id', 'legal_entity_id']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_global_hr', name: 'works_council_consultations' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_global_hr', name: 'work_authorization_cases' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_global_hr', name: 'statutory_leave_types' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_global_hr', name: 'country_rule_sets' }, { cascade: true });
};
