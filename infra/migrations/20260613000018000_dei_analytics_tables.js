exports.up = (pgm) => {
  pgm.createSchema('hr_dei_analytics', { ifNotExists: true });

  pgm.createTable({ schema: 'hr_dei_analytics', name: 'dei_reports' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    report_type: { type: 'text', notNull: true },
    reporting_period: { type: 'text', notNull: true },
    country_code: { type: 'char(2)', notNull: true },
    legal_entity_id: { type: 'uuid', notNull: true },
    metrics: { type: 'jsonb', notNull: true, default: '{}' },
    aggregation_threshold: { type: 'integer', notNull: true, default: 5 },
    suppression_applied: { type: 'boolean', notNull: true, default: false },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_dei_analytics', name: 'dei_reports' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_dei_analytics', name: 'dei_reports' }, ['tenant_id', 'report_type']);

  pgm.createTable({ schema: 'hr_dei_analytics', name: 'pay_gap_reports' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    report_type: { type: 'text', notNull: true },
    reporting_year: { type: 'integer', notNull: true },
    country_code: { type: 'char(2)', notNull: true },
    mean_hourly_gap: { type: 'numeric' },
    median_hourly_gap: { type: 'numeric' },
    quartile_distribution: { type: 'jsonb', notNull: true, default: '{}' },
    action_plan: { type: 'jsonb', notNull: true, default: '{}' },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_dei_analytics', name: 'pay_gap_reports' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_dei_analytics', name: 'pay_gap_reports' }, ['tenant_id', 'reporting_year']);

  pgm.createTable({ schema: 'hr_dei_analytics', name: 'pay_equity_reviews' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    review_name: { type: 'text', notNull: true },
    review_period: { type: 'text', notNull: true },
    scope: { type: 'jsonb', notNull: true, default: '{}' },
    findings: { type: 'jsonb', notNull: true, default: '{}' },
    remediation_actions: { type: 'jsonb', notNull: true, default: '{}' },
    completed_actions: { type: 'jsonb', notNull: true, default: '{}' },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_dei_analytics', name: 'pay_equity_reviews' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_dei_analytics', name: 'pay_equity_reviews' }, ['tenant_id', 'review_period']);

  pgm.createTable({ schema: 'hr_dei_analytics', name: 'attrition_segment_reports' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    report_period: { type: 'text', notNull: true },
    segment_type: { type: 'text', notNull: true },
    segments: { type: 'jsonb', notNull: true, default: '{}' },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_dei_analytics', name: 'attrition_segment_reports' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_dei_analytics', name: 'attrition_segment_reports' }, ['tenant_id', 'report_period']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_dei_analytics', name: 'attrition_segment_reports' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_dei_analytics', name: 'pay_equity_reviews' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_dei_analytics', name: 'pay_gap_reports' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_dei_analytics', name: 'dei_reports' }, { cascade: true });
  pgm.dropSchema('hr_dei_analytics', { ifExists: true });
};
