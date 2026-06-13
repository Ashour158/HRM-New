exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_wellbeing', name: 'wellness_programs' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    name: { type: 'text', notNull: true },
    type: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    start_date: { type: 'timestamptz' },
    end_date: { type: 'timestamptz' },
    description: { type: 'text' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_wellbeing', name: 'wellness_programs' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_wellbeing', name: 'wellness_programs' }, ['tenant_id', 'type']);

  pgm.createTable({ schema: 'hr_wellbeing', name: 'eap_referrals' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    reason: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true, default: 'REQUESTED' },
    scheduled_date: { type: 'timestamptz' },
    completed_date: { type: 'timestamptz' },
    provider_id: { type: 'uuid' },
    notes: { type: 'text' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_wellbeing', name: 'eap_referrals' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_wellbeing', name: 'eap_referrals' }, ['tenant_id', 'worker_id']);
  pgm.createIndex({ schema: 'hr_wellbeing', name: 'eap_referrals' }, ['tenant_id', 'provider_id']);

  pgm.createTable({ schema: 'hr_wellbeing', name: 'mental_health_cases' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    severity: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true, default: 'OPEN' },
    provider_id: { type: 'uuid' },
    notes: { type: 'text' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_wellbeing', name: 'mental_health_cases' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_wellbeing', name: 'mental_health_cases' }, ['tenant_id', 'worker_id']);
  pgm.createIndex({ schema: 'hr_wellbeing', name: 'mental_health_cases' }, ['tenant_id', 'provider_id']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_wellbeing', name: 'mental_health_cases' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_wellbeing', name: 'eap_referrals' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_wellbeing', name: 'wellness_programs' }, { cascade: true });
};
