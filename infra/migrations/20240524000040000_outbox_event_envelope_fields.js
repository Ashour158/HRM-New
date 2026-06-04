exports.up = (pgm) => {
  pgm.addColumns({ schema: 'hr_platform', name: 'outbox_events' }, {
    event_schema_version: { type: 'integer', notNull: true, default: 1 },
    event_topic: { type: 'text' },
    envelope_version: { type: 'integer', notNull: true, default: 1 },
  });

  pgm.sql(`
    UPDATE "hr_platform"."outbox_events"
    SET
      event_schema_version = CASE
        WHEN metadata->>'eventSchemaVersion' ~ '^[0-9]+$' THEN (metadata->>'eventSchemaVersion')::integer
        ELSE 1
      END,
      event_topic = NULLIF(metadata->>'topic', ''),
      envelope_version = CASE
        WHEN metadata->>'envelopeVersion' ~ '^[0-9]+$' THEN (metadata->>'envelopeVersion')::integer
        ELSE 1
      END
  `);

  pgm.createIndex(
    { schema: 'hr_platform', name: 'outbox_events' },
    ['tenant_id', 'event_topic', 'created_at'],
    { name: 'outbox_events_tenant_topic_created_at_idx' },
  );
};

exports.down = (pgm) => {
  pgm.dropIndex(
    { schema: 'hr_platform', name: 'outbox_events' },
    ['tenant_id', 'event_topic', 'created_at'],
    { name: 'outbox_events_tenant_topic_created_at_idx', ifExists: true },
  );
  pgm.dropColumns({ schema: 'hr_platform', name: 'outbox_events' }, [
    'event_schema_version',
    'event_topic',
    'envelope_version',
  ]);
};
