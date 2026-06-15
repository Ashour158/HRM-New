exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_engagement', name: 'feedback_360_cycles' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    subject_worker_id: { type: 'uuid', notNull: true },
    reviewers: { type: 'jsonb', notNull: true, default: '[]' },
    competencies: { type: 'jsonb', notNull: true, default: '[]' },
    responses: { type: 'jsonb', notNull: true, default: '[]' },
    start_date: { type: 'timestamptz' },
    end_date: { type: 'timestamptz' },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex({ schema: 'hr_engagement', name: 'feedback_360_cycles' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_engagement', name: 'feedback_360_cycles' }, ['tenant_id', 'subject_worker_id']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_engagement', name: 'feedback_360_cycles' }, { cascade: true });
};
