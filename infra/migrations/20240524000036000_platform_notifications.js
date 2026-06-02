exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_platform', name: 'platform_notifications' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'tenants' } },
    audience: { type: 'text', notNull: true },
    recipient_worker_id: { type: 'uuid' },
    recipient_role: { type: 'text' },
    category: { type: 'text', notNull: true },
    title: { type: 'text', notNull: true },
    body: { type: 'text', notNull: true },
    source_event_id: { type: 'uuid', notNull: true },
    source_event_name: { type: 'text', notNull: true },
    related_aggregate_type: { type: 'text', notNull: true },
    related_aggregate_id: { type: 'uuid', notNull: true },
    payload: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    delivery_status: { type: 'text', notNull: true, default: 'READY' },
    read_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    { schema: 'hr_platform', name: 'platform_notifications' },
    'platform_notifications_audience_check',
    "CHECK (audience IN ('EMPLOYEE', 'MANAGER', 'HR_OPERATIONS'))",
  );
  pgm.addConstraint(
    { schema: 'hr_platform', name: 'platform_notifications' },
    'platform_notifications_delivery_status_check',
    "CHECK (delivery_status IN ('READY', 'DELIVERED', 'FAILED'))",
  );
  pgm.sql(`
    CREATE UNIQUE INDEX platform_notifications_event_audience_unique
    ON "hr_platform"."platform_notifications" (
      tenant_id,
      source_event_id,
      audience,
      COALESCE(recipient_worker_id, '00000000-0000-0000-0000-000000000000'::uuid),
      COALESCE(recipient_role, '')
    );
  `);
  pgm.createIndex({ schema: 'hr_platform', name: 'platform_notifications' }, ['tenant_id', 'recipient_worker_id', 'read_at', 'created_at']);
  pgm.createIndex({ schema: 'hr_platform', name: 'platform_notifications' }, ['tenant_id', 'recipient_role', 'created_at']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_platform', name: 'platform_notifications' }, { cascade: true });
};
