exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_platform', name: 'tenants' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'text', notNull: true },
    slug: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true },
    settings: { type: 'jsonb', default: pgm.func("'{}'::jsonb") },
    enabled_modules: { type: 'text[]', default: pgm.func("'{}'::text[]") },
    data_residency_region: { type: 'text' },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', default: pgm.func('now()') },
  });
  pgm.addConstraint({ schema: 'hr_platform', name: 'tenants' }, 'tenants_slug_unique', 'UNIQUE(slug)');
  pgm.addConstraint({ schema: 'hr_platform', name: 'tenants' }, 'tenants_status_check', "CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_SETUP'))");

  pgm.createTable({ schema: 'hr_platform', name: 'audit_log' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'tenants' } },
    actor_type: { type: 'text', notNull: true },
    actor_id: { type: 'uuid', notNull: true },
    action: { type: 'text', notNull: true },
    resource_type: { type: 'text', notNull: true },
    resource_id: { type: 'uuid', notNull: true },
    payload: { type: 'jsonb' },
    occurred_at: { type: 'timestamptz', default: pgm.func('now()') },
    correlation_id: { type: 'uuid', notNull: true },
    causation_id: { type: 'uuid' },
    process_instance_id: { type: 'text' },
    ip_address: { type: 'inet' },
    user_agent: { type: 'text' },
    decision_record_id: { type: 'uuid' },
    field_access_decisions: { type: 'jsonb' },
    data_classification: { type: 'text' },
    legal_hold_status: { type: 'text' },
    retention_class: { type: 'text' },
  });
  pgm.createIndex({ schema: 'hr_platform', name: 'audit_log' }, ['tenant_id', 'resource_type', 'resource_id']);
  pgm.createIndex({ schema: 'hr_platform', name: 'audit_log' }, ['tenant_id', 'occurred_at']);
  pgm.createIndex({ schema: 'hr_platform', name: 'audit_log' }, ['correlation_id']);

  pgm.createTable({ schema: 'hr_platform', name: 'idempotency_keys' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'tenants' } },
    key: { type: 'text', notNull: true },
    hash: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true },
    command_name: { type: 'text', notNull: true },
    aggregate_type: { type: 'text', notNull: true },
    aggregate_id: { type: 'uuid' },
    result: { type: 'jsonb' },
    error: { type: 'jsonb' },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
    expires_at: { type: 'timestamptz', notNull: true },
  });
  pgm.addConstraint({ schema: 'hr_platform', name: 'idempotency_keys' }, 'idempotency_keys_tenant_key_unique', 'UNIQUE(tenant_id, key)');
  pgm.addConstraint({ schema: 'hr_platform', name: 'idempotency_keys' }, 'idempotency_keys_status_check', "CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED'))");
  pgm.createIndex({ schema: 'hr_platform', name: 'idempotency_keys' }, ['expires_at']);

  pgm.createTable({ schema: 'hr_platform', name: 'transition_ledgers' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'tenants' } },
    aggregate_type: { type: 'text', notNull: true },
    aggregate_id: { type: 'uuid', notNull: true },
    from_state: { type: 'text', notNull: true },
    to_state: { type: 'text', notNull: true },
    action: { type: 'text', notNull: true },
    triggered_by: { type: 'uuid', notNull: true },
    occurred_at: { type: 'timestamptz', default: pgm.func('now()') },
    correlation_id: { type: 'uuid', notNull: true },
    decision_record_id: { type: 'uuid' },
    command_id: { type: 'uuid', notNull: true },
  });
  pgm.createIndex({ schema: 'hr_platform', name: 'transition_ledgers' }, ['tenant_id', 'aggregate_type', 'aggregate_id']);
  pgm.createIndex({ schema: 'hr_platform', name: 'transition_ledgers' }, ['tenant_id', 'occurred_at']);

  pgm.createTable({ schema: 'hr_platform', name: 'outbox_events' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'tenants' } },
    event_name: { type: 'text', notNull: true },
    aggregate_type: { type: 'text', notNull: true },
    aggregate_id: { type: 'uuid', notNull: true },
    payload: { type: 'jsonb', notNull: true },
    metadata: { type: 'jsonb', notNull: true },
    correlation_id: { type: 'uuid', notNull: true },
    causation_id: { type: 'uuid' },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
    published_at: { type: 'timestamptz' },
    publish_attempt_count: { type: 'integer', default: 0 },
  });
  pgm.sql('CREATE INDEX outbox_events_published_at_idx ON "hr_platform"."outbox_events" (published_at NULLS FIRST);');
  pgm.createIndex({ schema: 'hr_platform', name: 'outbox_events' }, ['tenant_id', 'created_at']);

  pgm.createTable({ schema: 'hr_platform', name: 'inbox_events' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'tenants' } },
    consumer_name: { type: 'text', notNull: true },
    consumer_version: { type: 'text', notNull: true },
    source_event_id: { type: 'uuid', notNull: true },
    source_topic: { type: 'text', notNull: true },
    source_partition: { type: 'integer' },
    source_offset: { type: 'bigint' },
    event_name: { type: 'text', notNull: true },
    aggregate_type: { type: 'text', notNull: true },
    aggregate_id: { type: 'uuid', notNull: true },
    processing_status: { type: 'text', notNull: true },
    retry_count: { type: 'integer', default: 0 },
    next_retry_at: { type: 'timestamptz' },
    error_summary: { type: 'text' },
    processed_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
  });
  pgm.addConstraint({ schema: 'hr_platform', name: 'inbox_events' }, 'inbox_events_consumer_source_unique', 'UNIQUE(consumer_name, consumer_version, source_event_id)');
  pgm.addConstraint({ schema: 'hr_platform', name: 'inbox_events' }, 'inbox_events_processing_status_check', "CHECK (processing_status IN ('IN_PROGRESS', 'SUCCESS', 'FAILED_RETRYABLE', 'FAILED_NON_RETRYABLE', 'SKIPPED'))");
  pgm.createIndex({ schema: 'hr_platform', name: 'inbox_events' }, ['tenant_id', 'processing_status', 'next_retry_at']);
  pgm.createIndex({ schema: 'hr_platform', name: 'inbox_events' }, ['tenant_id', 'consumer_name', 'created_at']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_platform', name: 'inbox_events' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_platform', name: 'outbox_events' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_platform', name: 'transition_ledgers' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_platform', name: 'idempotency_keys' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_platform', name: 'audit_log' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_platform', name: 'tenants' }, { cascade: true });
};
