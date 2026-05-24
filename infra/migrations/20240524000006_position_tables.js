exports.up = (pgm) => {
  pgm.createTable('hr_position.positions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    position_code: { type: 'text', notNull: true },
    title: { type: 'text', notNull: true },
    department_id: { type: 'uuid' },
    legal_entity_id: { type: 'uuid' },
    job_family: { type: 'text' },
    job_level: { type: 'text' },
    employment_type: { type: 'text' },
    status: { type: 'text', default: 'DRAFT' },
    filled_by_worker_id: { type: 'uuid' },
    headcount_request_id: { type: 'uuid' },
    aggregate_version: { type: 'bigint', default: 0 },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', default: pgm.func('now()') },
  });
  pgm.addConstraint('hr_position.positions', 'positions_tenant_code_unique', 'UNIQUE(tenant_id, position_code)');

  pgm.createTable('hr_position.headcount_requests', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    request_number: { type: 'text' },
    department_id: { type: 'uuid' },
    legal_entity_id: { type: 'uuid' },
    justification: { type: 'text' },
    requested_by: { type: 'uuid' },
    approved_by: { type: 'uuid' },
    status: { type: 'text', default: 'DRAFT' },
    aggregate_version: { type: 'bigint', default: 0 },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', default: pgm.func('now()') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('hr_position.headcount_requests', { cascade: true });
  pgm.dropTable('hr_position.positions', { cascade: true });
};
