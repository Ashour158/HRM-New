exports.up = (pgm) => {
  pgm.createTable({ name: 'admin_module_operation_controls' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    module_id: { type: 'text', notNull: true },
    control_name: { type: 'text', notNull: true },
    control_type: { type: 'text', notNull: true },
    owner_role: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true, default: 'Draft' },
    last_event: { type: 'text', notNull: true },
    payload: { type: 'jsonb', notNull: true, default: '{}' },
    created_by: { type: 'text' },
    updated_by: { type: 'text' },
    aggregate_version: { type: 'integer', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint(
    'admin_module_operation_controls',
    'admin_module_operation_controls_tenant_module_name_unique',
    'UNIQUE(tenant_id, module_id, control_name)',
  );
  pgm.createIndex('admin_module_operation_controls', ['tenant_id', 'module_id', 'status']);
};

exports.down = (pgm) => {
  pgm.dropTable('admin_module_operation_controls', { cascade: true });
};
