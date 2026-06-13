exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_platform', name: 'users' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'tenants' }, onDelete: 'CASCADE' },
    email: { type: 'text', notNull: true },
    first_name: { type: 'text', notNull: true, default: '' },
    last_name: { type: 'text', notNull: true, default: '' },
    password_hash: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true, default: 'ACTIVE' },
    roles: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    permissions: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    mfa_secret: { type: 'text' },
    failed_login_count: { type: 'integer', notNull: true, default: 0 },
    locked_until: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint({ schema: 'hr_platform', name: 'users' }, 'users_status_check', "CHECK (status IN ('ACTIVE', 'INVITED', 'DISABLED', 'LOCKED', 'PASSWORD_RESET_REQUIRED'))");
  pgm.createIndex({ schema: 'hr_platform', name: 'users' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_platform', name: 'users' }, ['tenant_id', 'email']);
  pgm.sql('CREATE UNIQUE INDEX users_tenant_email_lower_unique ON hr_platform.users (tenant_id, lower(email));');

  pgm.createTable({ schema: 'hr_platform', name: 'auth_sessions' }, {
    id: { type: 'uuid', primaryKey: true },
    tenant_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'tenants' }, onDelete: 'CASCADE' },
    user_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'users' }, onDelete: 'CASCADE' },
    mfa_authenticated: { type: 'boolean', notNull: true, default: false },
    metadata: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    expires_at: { type: 'timestamptz', notNull: true },
    revoked_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_platform', name: 'auth_sessions' }, ['tenant_id', 'user_id']);
  pgm.createIndex({ schema: 'hr_platform', name: 'auth_sessions' }, ['expires_at']);

  pgm.createTable({ schema: 'hr_platform', name: 'auth_tokens' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'tenants' }, onDelete: 'CASCADE' },
    user_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'users' }, onDelete: 'CASCADE' },
    token_hash: { type: 'text', notNull: true, unique: true },
    token_type: { type: 'text', notNull: true },
    email: { type: 'text' },
    metadata: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    expires_at: { type: 'timestamptz', notNull: true },
    consumed_at: { type: 'timestamptz' },
    created_by: { type: 'uuid' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint({ schema: 'hr_platform', name: 'auth_tokens' }, 'auth_tokens_type_check', "CHECK (token_type IN ('SET_PASSWORD', 'PASSWORD_RESET'))");
  pgm.createIndex({ schema: 'hr_platform', name: 'auth_tokens' }, ['tenant_id', 'user_id', 'token_type']);
  pgm.createIndex({ schema: 'hr_platform', name: 'auth_tokens' }, ['token_hash']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_platform', name: 'auth_tokens' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_platform', name: 'auth_sessions' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_platform', name: 'users' }, { cascade: true });
};
