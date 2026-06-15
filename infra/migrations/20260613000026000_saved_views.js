exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_platform', name: 'saved_views' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: {
      type: 'uuid',
      notNull: true,
      references: { schema: 'hr_platform', name: 'tenants' },
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: { schema: 'hr_platform', name: 'users' },
      onDelete: 'CASCADE',
    },
    list_key: { type: 'text', notNull: true },
    name: { type: 'text', notNull: true },
    filters: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    columns: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    is_default: { type: 'boolean', notNull: true, default: false },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    { schema: 'hr_platform', name: 'saved_views' },
    'saved_views_user_list_name_unique',
    'UNIQUE(tenant_id, user_id, list_key, name)',
  );
  pgm.createIndex({ schema: 'hr_platform', name: 'saved_views' }, ['tenant_id', 'user_id', 'list_key']);
  pgm.createIndex({ schema: 'hr_platform', name: 'saved_views' }, ['tenant_id', 'list_key', 'is_default']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_platform', name: 'saved_views' }, { cascade: true });
};
