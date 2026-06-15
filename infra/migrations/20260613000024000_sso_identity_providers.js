exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_platform', name: 'tenant_identity_providers' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: {
      type: 'uuid',
      notNull: true,
      references: { schema: 'hr_platform', name: 'tenants' },
      onDelete: 'CASCADE',
    },
    protocol: { type: 'text', notNull: true },
    display_name: { type: 'text', notNull: true },
    enabled: { type: 'boolean', notNull: true, default: false },
    jit_provisioning: { type: 'boolean', notNull: true, default: true },
    default_roles: { type: 'jsonb', notNull: true, default: pgm.func(`'["EMPLOYEE"]'::jsonb`) },
    attribute_mapping: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    group_role_mapping: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    oidc_issuer_url: { type: 'text' },
    oidc_client_id: { type: 'text' },
    oidc_client_secret_enc: { type: 'text' },
    oidc_scopes: { type: 'jsonb', notNull: true, default: pgm.func(`'["openid","email","profile"]'::jsonb`) },
    saml_idp_entity_id: { type: 'text' },
    saml_idp_sso_url: { type: 'text' },
    saml_idp_x509_cert: { type: 'text' },
    saml_sp_private_key_enc: { type: 'text' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    { schema: 'hr_platform', name: 'tenant_identity_providers' },
    'tenant_identity_providers_protocol_check',
    "CHECK (protocol IN ('OIDC', 'SAML'))",
  );
  pgm.addConstraint(
    { schema: 'hr_platform', name: 'tenant_identity_providers' },
    'tenant_identity_providers_tenant_protocol_unique',
    'UNIQUE(tenant_id, protocol)',
  );
  pgm.createIndex({ schema: 'hr_platform', name: 'tenant_identity_providers' }, ['tenant_id', 'enabled']);
  pgm.createIndex({ schema: 'hr_platform', name: 'tenant_identity_providers' }, ['tenant_id', 'protocol']);

  pgm.addColumns({ schema: 'hr_platform', name: 'users' }, {
    idp_provider: { type: 'text' },
    external_id: { type: 'text' },
  });
  pgm.sql(`
    CREATE UNIQUE INDEX users_tenant_idp_external_unique
      ON hr_platform.users (tenant_id, idp_provider, external_id)
      WHERE external_id IS NOT NULL
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP INDEX IF EXISTS hr_platform.users_tenant_idp_external_unique');
  pgm.dropColumns({ schema: 'hr_platform', name: 'users' }, ['idp_provider', 'external_id']);
  pgm.dropTable({ schema: 'hr_platform', name: 'tenant_identity_providers' }, { cascade: true });
};
