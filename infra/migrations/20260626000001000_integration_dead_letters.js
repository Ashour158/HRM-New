/**
 * Durable store for integration dead-letters (ARCH-8). The orchestrator previously
 * kept dead-lettered sends only in a process-local array, lost on restart. This table
 * persists them so operators can inspect and replay failures across restarts.
 *
 * Platform-operational / cross-tenant by design (an integration send may have no
 * request tenant) — deliberately NOT tenant-scoped, so it is not covered by the
 * tenant_isolation RLS policy and stays operator-visible.
 */
exports.up = (pgm) => {
  pgm.createTable(
    { schema: 'hr_platform', name: 'integration_dead_letters' },
    {
      id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
      adapter_name: { type: 'text', notNull: true },
      payload: { type: 'jsonb' },
      attempt: { type: 'integer', notNull: true },
      error: { type: 'text', notNull: true },
      created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    },
  );
  pgm.createIndex({ schema: 'hr_platform', name: 'integration_dead_letters' }, ['adapter_name', 'created_at']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_platform', name: 'integration_dead_letters' });
};
