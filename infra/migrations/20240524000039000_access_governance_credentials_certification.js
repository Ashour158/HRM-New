exports.up = (pgm) => {
  pgm.addColumns({ schema: 'hr_platform', name: 'access_review_campaigns' }, {
    last_reminder_at: { type: 'timestamptz' },
    escalated_at: { type: 'timestamptz' },
    escalation_count: { type: 'integer', notNull: true, default: 0 },
  });

  pgm.createTable({ schema: 'hr_platform', name: 'service_account_credentials' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'tenants' } },
    service_account_id: {
      type: 'uuid',
      notNull: true,
      references: { schema: 'hr_platform', name: 'service_accounts' },
      onDelete: 'CASCADE',
    },
    name: { type: 'text', notNull: true, default: 'Default credential' },
    secret_hash: { type: 'text', notNull: true },
    secret_prefix: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true, default: 'ACTIVE' },
    scopes: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    issued_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    expires_at: { type: 'timestamptz' },
    last_used_at: { type: 'timestamptz' },
    rotated_at: { type: 'timestamptz' },
    revoked_at: { type: 'timestamptz' },
    revoked_reason: { type: 'text' },
    created_by: { type: 'uuid' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    { schema: 'hr_platform', name: 'service_account_credentials' },
    'service_account_credentials_status_check',
    "CHECK (status IN ('ACTIVE', 'ROTATED', 'REVOKED', 'EXPIRED'))",
  );
  pgm.createIndex({ schema: 'hr_platform', name: 'service_account_credentials' }, ['tenant_id', 'service_account_id', 'status']);
  pgm.createIndex({ schema: 'hr_platform', name: 'service_account_credentials' }, ['tenant_id', 'expires_at']);

  pgm.createTable({ schema: 'hr_platform', name: 'access_review_workflow_events' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'tenants' } },
    campaign_id: {
      type: 'uuid',
      notNull: true,
      references: { schema: 'hr_platform', name: 'access_review_campaigns' },
      onDelete: 'CASCADE',
    },
    event_type: { type: 'text', notNull: true },
    actor_id: { type: 'uuid' },
    target_role: { type: 'text' },
    message: { type: 'text' },
    pending_item_count: { type: 'integer', notNull: true, default: 0 },
    payload: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    { schema: 'hr_platform', name: 'access_review_workflow_events' },
    'access_review_workflow_events_type_check',
    "CHECK (event_type IN ('LAUNCHED', 'REMINDER_SENT', 'ESCALATED', 'COMPLETED'))",
  );
  pgm.createIndex({ schema: 'hr_platform', name: 'access_review_workflow_events' }, ['tenant_id', 'campaign_id', 'created_at']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_platform', name: 'access_review_workflow_events' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_platform', name: 'service_account_credentials' }, { cascade: true });
  pgm.dropColumns({ schema: 'hr_platform', name: 'access_review_campaigns' }, [
    'last_reminder_at',
    'escalated_at',
    'escalation_count',
  ]);
};
