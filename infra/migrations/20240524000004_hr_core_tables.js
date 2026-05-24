exports.up = (pgm) => {
  pgm.createTable('hr_core.workers', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: 'hr_platform.tenants(id)' },
    employee_number: { type: 'text' },
    status: { type: 'text', notNull: true },
    aggregate_version: { type: 'bigint', default: 0 },
    first_name: { type: 'text' },
    last_name: { type: 'text' },
    email: { type: 'text' },
    hire_date: { type: 'date' },
    termination_date: { type: 'date' },
    legal_entity_id: { type: 'uuid' },
    department_id: { type: 'uuid' },
    manager_id: { type: 'uuid' },
    job_title: { type: 'text' },
    employment_type: { type: 'text' },
    data_classification: { type: 'text', default: 'CONFIDENTIAL' },
    legal_hold_status: { type: 'text', default: 'NONE' },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', default: pgm.func('now()') },
    created_by: { type: 'uuid' },
    updated_by: { type: 'uuid' },
  });
  pgm.addConstraint('hr_core.workers', 'workers_status_check', "CHECK (status IN ('DRAFT', 'PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED', 'TERMINATED', 'REHIRED'))");
  pgm.addConstraint('hr_core.workers', 'workers_tenant_employee_number_unique', 'UNIQUE(tenant_id, employee_number)');
  pgm.createIndex('hr_core.workers', ['tenant_id', 'status']);
  pgm.createIndex('hr_core.workers', ['tenant_id', 'manager_id']);
  pgm.createIndex('hr_core.workers', ['tenant_id', 'legal_entity_id']);

  pgm.createTable('hr_core.employment_relationships', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    relationship_type: { type: 'text', notNull: true },
    start_date: { type: 'date', notNull: true },
    end_date: { type: 'date' },
    legal_entity_id: { type: 'uuid' },
    contract_type: { type: 'text' },
    probation_end_date: { type: 'date' },
    aggregate_version: { type: 'bigint', default: 0 },
    state: { type: 'text', default: 'DRAFT' },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', default: pgm.func('now()') },
  });
  pgm.createIndex('hr_core.employment_relationships', ['tenant_id', 'worker_id']);

  pgm.createTable('hr_core.job_assignments', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    position_id: { type: 'uuid' },
    department_id: { type: 'uuid' },
    manager_id: { type: 'uuid' },
    job_title: { type: 'text' },
    start_date: { type: 'date', notNull: true },
    end_date: { type: 'date' },
    assignment_type: { type: 'text' },
    aggregate_version: { type: 'bigint', default: 0 },
    state: { type: 'text', default: 'DRAFT' },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', default: pgm.func('now()') },
  });
  pgm.createIndex('hr_core.job_assignments', ['tenant_id', 'worker_id']);

  pgm.createTable('hr_core.employment_contracts', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    contract_type: { type: 'text', notNull: true },
    start_date: { type: 'date', notNull: true },
    end_date: { type: 'date' },
    terms: { type: 'jsonb' },
    signed_at: { type: 'timestamptz' },
    aggregate_version: { type: 'bigint', default: 0 },
    state: { type: 'text', default: 'DRAFT' },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', default: pgm.func('now()') },
  });
  pgm.createIndex('hr_core.employment_contracts', ['tenant_id', 'worker_id']);

  pgm.createTable('hr_core.personal_data_records', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    data_category: { type: 'text', notNull: true },
    data_classification: { type: 'text', notNull: true, default: 'CONFIDENTIAL' },
    encrypted_payload_ref: { type: 'text' },
    payload: { type: 'jsonb' },
    consent_status: { type: 'text' },
    aggregate_version: { type: 'bigint', default: 0 },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', default: pgm.func('now()') },
  });
  pgm.createIndex('hr_core.personal_data_records', ['tenant_id', 'worker_id']);
};

exports.down = (pgm) => {
  pgm.dropTable('hr_core.personal_data_records', { cascade: true });
  pgm.dropTable('hr_core.employment_contracts', { cascade: true });
  pgm.dropTable('hr_core.job_assignments', { cascade: true });
  pgm.dropTable('hr_core.employment_relationships', { cascade: true });
  pgm.dropTable('hr_core.workers', { cascade: true });
};
