exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_union', name: 'union_recognitions' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    union_name: { type: 'text', notNull: true },
    bargaining_unit_id: { type: 'uuid', notNull: true },
    status: { type: 'text', notNull: true, default: 'RECOGNIZED' },
    effective_date: { type: 'timestamptz' },
    expiration_date: { type: 'timestamptz' },
    agreement_document: { type: 'text' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_union', name: 'union_recognitions' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_union', name: 'union_recognitions' }, ['tenant_id', 'bargaining_unit_id']);

  pgm.createTable({ schema: 'hr_union', name: 'collective_bargaining_sessions' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    union_recognition_id: { type: 'uuid', notNull: true },
    session_date: { type: 'timestamptz', notNull: true },
    status: { type: 'text', notNull: true, default: 'SCHEDULED' },
    location: { type: 'text' },
    agenda: { type: 'text' },
    minutes: { type: 'text' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_union', name: 'collective_bargaining_sessions' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_union', name: 'collective_bargaining_sessions' }, ['tenant_id', 'union_recognition_id']);
  pgm.createIndex({ schema: 'hr_union', name: 'collective_bargaining_sessions' }, ['tenant_id', 'session_date']);
  pgm.addConstraint(
    { schema: 'hr_union', name: 'collective_bargaining_sessions' },
    'collective_bargaining_sessions_recognition_fk',
    'FOREIGN KEY (union_recognition_id) REFERENCES hr_union.union_recognitions(id) ON DELETE CASCADE',
  );

  pgm.createTable({ schema: 'hr_union', name: 'grievances' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    grievance_type: { type: 'text', notNull: true },
    description: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true, default: 'FILED' },
    resolution: { type: 'text' },
    arbitrator_decision: { type: 'text' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_union', name: 'grievances' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_union', name: 'grievances' }, ['tenant_id', 'worker_id']);
  pgm.createIndex({ schema: 'hr_union', name: 'grievances' }, ['tenant_id', 'grievance_type']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_union', name: 'grievances' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_union', name: 'collective_bargaining_sessions' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_union', name: 'union_recognitions' }, { cascade: true });
};
