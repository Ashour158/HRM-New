exports.up = (pgm) => {
  pgm.createTable('hr_org.legal_entities', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    name: { type: 'text', notNull: true },
    code: { type: 'text', notNull: true },
    country_code: { type: 'text', notNull: true },
    registration_number: { type: 'text' },
    status: { type: 'text', default: 'DRAFT' },
    aggregate_version: { type: 'bigint', default: 0 },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', default: pgm.func('now()') },
  });
  pgm.addConstraint('hr_org.legal_entities', 'legal_entities_tenant_code_unique', 'UNIQUE(tenant_id, code)');

  pgm.createTable('hr_org.org_units', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    name: { type: 'text', notNull: true },
    code: { type: 'text' },
    parent_id: { type: 'uuid', references: 'hr_org.org_units(id)' },
    legal_entity_id: { type: 'uuid' },
    level: { type: 'integer', default: 0 },
    path: { type: 'text' },
    status: { type: 'text', default: 'ACTIVE' },
    aggregate_version: { type: 'bigint', default: 0 },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', default: pgm.func('now()') },
  });
  pgm.createIndex('hr_org.org_units', ['tenant_id', 'parent_id']);
  pgm.createIndex('hr_org.org_units', ['tenant_id', 'path']);

  pgm.createTable('hr_org.manager_relationships', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    manager_id: { type: 'uuid', notNull: true },
    department_id: { type: 'uuid' },
    is_primary: { type: 'boolean', default: true },
    start_date: { type: 'date', notNull: true },
    end_date: { type: 'date' },
    aggregate_version: { type: 'bigint', default: 0 },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', default: pgm.func('now()') },
  });
  pgm.createIndex('hr_org.manager_relationships', ['tenant_id', 'worker_id']);
  pgm.createIndex('hr_org.manager_relationships', ['tenant_id', 'manager_id']);
};

exports.down = (pgm) => {
  pgm.dropTable('hr_org.manager_relationships', { cascade: true });
  pgm.dropTable('hr_org.org_units', { cascade: true });
  pgm.dropTable('hr_org.legal_entities', { cascade: true });
};
