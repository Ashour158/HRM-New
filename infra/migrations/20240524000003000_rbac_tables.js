exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_platform', name: 'roles' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'tenants' } },
    code: { type: 'text', notNull: true },
    name: { type: 'text', notNull: true },
    tier: { type: 'text', notNull: true },
    description: { type: 'text' },
    is_system: { type: 'boolean', default: false },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
  });
  pgm.addConstraint({ schema: 'hr_platform', name: 'roles' }, 'roles_tenant_code_unique', 'UNIQUE(tenant_id, code)');

  pgm.createTable({ schema: 'hr_platform', name: 'permissions' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'tenants' } },
    code: { type: 'text', notNull: true },
    description: { type: 'text' },
    domain: { type: 'text', notNull: true },
    data_classification: { type: 'text' },
    audit_on_access: { type: 'boolean', default: false },
  });
  pgm.addConstraint({ schema: 'hr_platform', name: 'permissions' }, 'permissions_tenant_code_unique', 'UNIQUE(tenant_id, code)');

  pgm.createTable({ schema: 'hr_platform', name: 'role_permissions' }, {
    role_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'roles' } },
    permission_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'permissions' } },
  });
  pgm.addConstraint({ schema: 'hr_platform', name: 'role_permissions' }, 'role_permissions_pkey', 'PRIMARY KEY (role_id, permission_id)');

  pgm.createTable({ schema: 'hr_platform', name: 'user_roles' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    user_id: { type: 'uuid', notNull: true },
    role_id: { type: 'uuid', references: { schema: 'hr_platform', name: 'roles' } },
    assigned_by: { type: 'uuid' },
    assigned_at: { type: 'timestamptz', default: pgm.func('now()') },
    expires_at: { type: 'timestamptz' },
  });
  pgm.addConstraint({ schema: 'hr_platform', name: 'user_roles' }, 'user_roles_tenant_user_role_unique', 'UNIQUE(tenant_id, user_id, role_id)');

  pgm.createTable({ schema: 'hr_platform', name: 'abac_policies' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    dimension: { type: 'text', notNull: true },
    conditions: { type: 'jsonb', notNull: true },
    effect: { type: 'text', notNull: true },
    priority: { type: 'integer', default: 0 },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
  });
  pgm.addConstraint({ schema: 'hr_platform', name: 'abac_policies' }, 'abac_policies_effect_check', "CHECK (effect IN ('ALLOW', 'DENY'))");

  pgm.createTable({ schema: 'hr_platform', name: 'field_access_policies' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    field_path: { type: 'text', notNull: true },
    data_classification: { type: 'text', notNull: true },
    role_decisions: { type: 'jsonb', notNull: true },
    self_service_decision: { type: 'text' },
    manager_decision: { type: 'text' },
    masking_rule: { type: 'text' },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
  });
  pgm.addConstraint({ schema: 'hr_platform', name: 'field_access_policies' }, 'field_access_policies_tenant_field_unique', 'UNIQUE(tenant_id, field_path)');

  pgm.createTable({ schema: 'hr_platform', name: 'sod_rules' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    code: { type: 'text', notNull: true },
    description: { type: 'text' },
    incompatible_role_pairs: { type: 'jsonb' },
    incompatible_permission_pairs: { type: 'jsonb' },
    enforcement_point: { type: 'text' },
    break_glass_allowed: { type: 'boolean', default: false },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_platform', name: 'sod_rules' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_platform', name: 'field_access_policies' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_platform', name: 'abac_policies' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_platform', name: 'user_roles' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_platform', name: 'role_permissions' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_platform', name: 'permissions' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_platform', name: 'roles' }, { cascade: true });
};
