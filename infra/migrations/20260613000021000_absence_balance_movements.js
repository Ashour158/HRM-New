exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_absence', name: 'absence_balance_movements' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    balance_id: { type: 'uuid', notNull: true },
    leave_type: { type: 'text', notNull: true },
    movement_type: { type: 'text', notNull: true },
    source_type: { type: 'text', notNull: true },
    source_id: { type: 'uuid', notNull: true },
    amount_hours: { type: 'numeric', notNull: true },
    before_hours: { type: 'numeric', notNull: true },
    after_hours: { type: 'numeric', notNull: true },
    occurred_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    correlation_id: { type: 'uuid', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_absence', name: 'absence_balance_movements' }, ['tenant_id', 'worker_id', 'occurred_at']);
  pgm.createIndex({ schema: 'hr_absence', name: 'absence_balance_movements' }, ['tenant_id', 'balance_id', 'occurred_at']);
  pgm.createConstraint(
    { schema: 'hr_absence', name: 'absence_balance_movements' },
    'absence_balance_movements_unique_source',
    'UNIQUE (tenant_id, source_type, source_id, movement_type)',
  );
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_absence', name: 'absence_balance_movements' }, { cascade: true });
};
