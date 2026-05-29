exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_platform', name: 'hcm_setup_configs' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: {
      type: 'uuid',
      notNull: true,
      references: { schema: 'hr_platform', name: 'tenants' },
      onDelete: 'cascade',
    },
    config: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', default: pgm.func('now()') },
  });
  pgm.addConstraint(
    { schema: 'hr_platform', name: 'hcm_setup_configs' },
    'hcm_setup_configs_tenant_unique',
    'UNIQUE(tenant_id)',
  );
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_platform', name: 'hcm_setup_configs' }, { cascade: true });
};
