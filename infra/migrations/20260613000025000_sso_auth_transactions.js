exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_platform', name: 'sso_auth_transactions' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: {
      type: 'uuid',
      notNull: true,
      references: { schema: 'hr_platform', name: 'tenants' },
      onDelete: 'CASCADE',
    },
    provider_id: {
      type: 'uuid',
      notNull: true,
      references: { schema: 'hr_platform', name: 'tenant_identity_providers' },
      onDelete: 'CASCADE',
    },
    protocol: { type: 'text', notNull: true },
    state: { type: 'text', notNull: true },
    pkce_verifier: { type: 'text' },
    nonce: { type: 'text' },
    relay_state: { type: 'text' },
    redirect_uri: { type: 'text' },
    expires_at: { type: 'timestamptz', notNull: true },
    consumed_at: { type: 'timestamptz' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    { schema: 'hr_platform', name: 'sso_auth_transactions' },
    'sso_auth_transactions_protocol_check',
    "CHECK (protocol IN ('OIDC', 'SAML'))",
  );
  pgm.addConstraint(
    { schema: 'hr_platform', name: 'sso_auth_transactions' },
    'sso_auth_transactions_state_unique',
    'UNIQUE(state)',
  );
  pgm.createIndex({ schema: 'hr_platform', name: 'sso_auth_transactions' }, ['tenant_id', 'provider_id', 'created_at']);
  pgm.createIndex({ schema: 'hr_platform', name: 'sso_auth_transactions' }, ['tenant_id', 'state']);
  pgm.createIndex({ schema: 'hr_platform', name: 'sso_auth_transactions' }, ['expires_at']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_platform', name: 'sso_auth_transactions' }, { cascade: true });
};
