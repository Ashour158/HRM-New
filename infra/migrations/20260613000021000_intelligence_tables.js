exports.up = (pgm) => {
  pgm.createSchema('hr_intelligence', { ifNotExists: true });

  pgm.createTable({ schema: 'hr_intelligence', name: 'attrition_risk_snapshots' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    period_key: { type: 'text', notNull: true },
    model_key: { type: 'text', notNull: true },
    model_version: { type: 'text', notNull: true },
    score: { type: 'numeric', notNull: true },
    band: { type: 'text', notNull: true },
    factors: { type: 'jsonb', notNull: true, default: '[]' },
    feature_snapshot: { type: 'jsonb', notNull: true, default: '{}' },
    source_event_id: { type: 'uuid' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_intelligence', name: 'attrition_risk_snapshots' }, ['tenant_id', 'worker_id']);
  pgm.createIndex({ schema: 'hr_intelligence', name: 'attrition_risk_snapshots' }, ['tenant_id', 'period_key']);
  pgm.createIndex({ schema: 'hr_intelligence', name: 'attrition_risk_snapshots' }, ['tenant_id', 'band']);

  pgm.createTable({ schema: 'hr_intelligence', name: 'attendance_payroll_anomaly_snapshots' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    period_key: { type: 'text', notNull: true },
    model_key: { type: 'text', notNull: true },
    model_version: { type: 'text', notNull: true },
    score: { type: 'numeric', notNull: true },
    band: { type: 'text', notNull: true },
    anomaly_type: { type: 'text', notNull: true },
    factors: { type: 'jsonb', notNull: true, default: '[]' },
    feature_snapshot: { type: 'jsonb', notNull: true, default: '{}' },
    notification_event_id: { type: 'uuid' },
    source_event_id: { type: 'uuid' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_intelligence', name: 'attendance_payroll_anomaly_snapshots' }, ['tenant_id', 'worker_id']);
  pgm.createIndex({ schema: 'hr_intelligence', name: 'attendance_payroll_anomaly_snapshots' }, ['tenant_id', 'period_key']);
  pgm.createIndex({ schema: 'hr_intelligence', name: 'attendance_payroll_anomaly_snapshots' }, ['tenant_id', 'band']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_intelligence', name: 'attendance_payroll_anomaly_snapshots' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_intelligence', name: 'attrition_risk_snapshots' }, { cascade: true });
  pgm.dropSchema('hr_intelligence', { ifExists: true });
};
