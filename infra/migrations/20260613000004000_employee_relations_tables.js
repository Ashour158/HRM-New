exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_er', name: 'employee_relations_cases' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    subject_worker_id: { type: 'uuid', notNull: true },
    manager_id: { type: 'uuid' },
    case_number: { type: 'text', notNull: true },
    case_type: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true, default: 'OPEN' },
    opened_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    assigned_to: { type: 'uuid' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_er', name: 'employee_relations_cases' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_er', name: 'employee_relations_cases' }, ['tenant_id', 'subject_worker_id']);
  pgm.createIndex({ schema: 'hr_er', name: 'employee_relations_cases' }, ['tenant_id', 'case_number']);

  pgm.createTable({ schema: 'hr_er', name: 'accommodation_cases' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    request_type: { type: 'text', notNull: true },
    medical_documentation: { type: 'text' },
    status: { type: 'text', notNull: true, default: 'REQUESTED' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_er', name: 'accommodation_cases' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_er', name: 'accommodation_cases' }, ['tenant_id', 'worker_id']);

  pgm.createTable({ schema: 'hr_er', name: 'disciplinary_actions' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    er_case_id: { type: 'uuid', notNull: true },
    action_type: { type: 'text', notNull: true },
    severity: { type: 'text', notNull: true },
    effective_date: { type: 'timestamptz', notNull: true },
    expiry_date: { type: 'timestamptz' },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_er', name: 'disciplinary_actions' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_er', name: 'disciplinary_actions' }, ['tenant_id', 'worker_id']);
  pgm.createIndex({ schema: 'hr_er', name: 'disciplinary_actions' }, ['tenant_id', 'er_case_id']);
  pgm.addConstraint(
    { schema: 'hr_er', name: 'disciplinary_actions' },
    'disciplinary_actions_case_fk',
    'FOREIGN KEY (er_case_id) REFERENCES hr_er.employee_relations_cases(id) ON DELETE CASCADE',
  );

  pgm.createTable({ schema: 'hr_er', name: 'er_investigations' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    er_case_id: { type: 'uuid', notNull: true },
    investigator_id: { type: 'uuid', notNull: true },
    findings: { type: 'text' },
    status: { type: 'text', notNull: true, default: 'PLANNED' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_er', name: 'er_investigations' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_er', name: 'er_investigations' }, ['tenant_id', 'er_case_id']);
  pgm.createIndex({ schema: 'hr_er', name: 'er_investigations' }, ['tenant_id', 'investigator_id']);
  pgm.addConstraint(
    { schema: 'hr_er', name: 'er_investigations' },
    'er_investigations_case_fk',
    'FOREIGN KEY (er_case_id) REFERENCES hr_er.employee_relations_cases(id) ON DELETE CASCADE',
  );
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_er', name: 'er_investigations' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_er', name: 'disciplinary_actions' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_er', name: 'accommodation_cases' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_er', name: 'employee_relations_cases' }, { cascade: true });
};
