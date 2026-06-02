exports.up = (pgm) => {
  pgm.createTable({ name: 'admin_module_operation_records' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    module_id: { type: 'text', notNull: true },
    object_type: { type: 'text', notNull: true },
    owner_role: { type: 'text', notNull: true },
    workflow_name: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true, default: 'In Review' },
    risk: { type: 'text', notNull: true, default: 'Medium' },
    last_event: { type: 'text', notNull: true },
    payload: { type: 'jsonb', notNull: true, default: '{}' },
    created_by: { type: 'text' },
    updated_by: { type: 'text' },
    aggregate_version: { type: 'integer', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('admin_module_operation_records', ['tenant_id', 'module_id', 'status']);
  pgm.createIndex('admin_module_operation_records', ['tenant_id', 'module_id', 'updated_at']);

  pgm.createTable({ name: 'admin_module_operation_workflows' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    module_id: { type: 'text', notNull: true },
    workflow_name: { type: 'text', notNull: true },
    owner_role: { type: 'text', notNull: true },
    state: { type: 'text', notNull: true, default: 'Queued' },
    sla_target: { type: 'text', notNull: true, default: '1d' },
    last_event: { type: 'text', notNull: true },
    payload: { type: 'jsonb', notNull: true, default: '{}' },
    created_by: { type: 'text' },
    updated_by: { type: 'text' },
    aggregate_version: { type: 'integer', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    'admin_module_operation_workflows',
    'admin_module_operation_workflows_tenant_module_workflow_unique',
    'UNIQUE(tenant_id, module_id, workflow_name)',
  );
  pgm.createIndex('admin_module_operation_workflows', ['tenant_id', 'module_id', 'state']);
};

exports.down = (pgm) => {
  pgm.dropTable('admin_module_operation_workflows', { cascade: true });
  pgm.dropTable('admin_module_operation_records', { cascade: true });
};
