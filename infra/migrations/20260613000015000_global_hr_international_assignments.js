exports.up = (pgm) => {
  pgm.createSchema('hr_global_hr', { ifNotExists: true });
  pgm.createTable({ schema: 'hr_global_hr', name: 'international_assignments' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    home_country: { type: 'text', notNull: true },
    host_country: { type: 'text', notNull: true },
    legal_entity_id: { type: 'uuid' },
    start_date: { type: 'timestamptz', notNull: true },
    end_date: { type: 'timestamptz', notNull: true },
    assignment_reason: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_global_hr', name: 'international_assignments' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_global_hr', name: 'international_assignments' }, ['tenant_id', 'worker_id']);
  pgm.createIndex({ schema: 'hr_global_hr', name: 'international_assignments' }, ['tenant_id', 'host_country']);
  pgm.createIndex({ schema: 'hr_global_hr', name: 'international_assignments' }, ['tenant_id', 'end_date']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_global_hr', name: 'international_assignments' }, { cascade: true });
};
