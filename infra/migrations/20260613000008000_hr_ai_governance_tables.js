exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_ai', name: 'hr_ai_use_cases' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    use_case_name: { type: 'text', notNull: true },
    use_case_type: { type: 'text', notNull: true },
    risk_classification: { type: 'text', notNull: true },
    description: { type: 'text' },
    data_usage: { type: 'jsonb', notNull: true, default: '{}' },
    human_oversight_required: { type: 'boolean', notNull: true, default: false },
    status: { type: 'text', notNull: true, default: 'REGISTERED' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_ai', name: 'hr_ai_use_cases' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_ai', name: 'hr_ai_use_cases' }, ['tenant_id', 'risk_classification']);
  pgm.createIndex({ schema: 'hr_ai', name: 'hr_ai_use_cases' }, ['tenant_id', 'use_case_type']);

  pgm.createTable({ schema: 'hr_ai', name: 'hr_ai_bias_tests' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    use_case_id: { type: 'uuid', notNull: true },
    test_type: { type: 'text', notNull: true },
    test_data: { type: 'jsonb', notNull: true, default: '{}' },
    metrics: { type: 'jsonb', notNull: true, default: '{}' },
    threshold: { type: 'numeric', notNull: true, default: 0.05 },
    passed: { type: 'boolean' },
    executed_at: { type: 'timestamptz' },
    status: { type: 'text', notNull: true, default: 'PLANNED' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_ai', name: 'hr_ai_bias_tests' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_ai', name: 'hr_ai_bias_tests' }, ['tenant_id', 'use_case_id']);
  pgm.createIndex({ schema: 'hr_ai', name: 'hr_ai_bias_tests' }, ['tenant_id', 'test_type']);
  pgm.addConstraint(
    { schema: 'hr_ai', name: 'hr_ai_bias_tests' },
    'hr_ai_bias_tests_use_case_fk',
    'FOREIGN KEY (use_case_id) REFERENCES hr_ai.hr_ai_use_cases(id) ON DELETE CASCADE',
  );

  pgm.createTable({ schema: 'hr_ai', name: 'hr_ai_model_runs' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    use_case_id: { type: 'uuid', notNull: true },
    model_version: { type: 'text', notNull: true },
    input_data_snapshot: { type: 'jsonb', notNull: true, default: '{}' },
    output_data_snapshot: { type: 'jsonb', notNull: true, default: '{}' },
    run_at: { type: 'timestamptz' },
    completed_at: { type: 'timestamptz' },
    status: { type: 'text', notNull: true, default: 'PENDING' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_ai', name: 'hr_ai_model_runs' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_ai', name: 'hr_ai_model_runs' }, ['tenant_id', 'use_case_id']);
  pgm.createIndex({ schema: 'hr_ai', name: 'hr_ai_model_runs' }, ['tenant_id', 'model_version']);
  pgm.addConstraint(
    { schema: 'hr_ai', name: 'hr_ai_model_runs' },
    'hr_ai_model_runs_use_case_fk',
    'FOREIGN KEY (use_case_id) REFERENCES hr_ai.hr_ai_use_cases(id) ON DELETE CASCADE',
  );

  pgm.createTable({ schema: 'hr_ai', name: 'hr_ai_kill_switches' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    use_case_id: { type: 'uuid', notNull: true },
    triggered_by: { type: 'uuid', notNull: true },
    trigger_reason: { type: 'text', notNull: true },
    triggered_at: { type: 'timestamptz' },
    resolved_at: { type: 'timestamptz' },
    resolution: { type: 'text' },
    status: { type: 'text', notNull: true, default: 'ARMED' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_ai', name: 'hr_ai_kill_switches' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_ai', name: 'hr_ai_kill_switches' }, ['tenant_id', 'use_case_id']);
  pgm.createIndex({ schema: 'hr_ai', name: 'hr_ai_kill_switches' }, ['tenant_id', 'triggered_by']);
  pgm.addConstraint(
    { schema: 'hr_ai', name: 'hr_ai_kill_switches' },
    'hr_ai_kill_switches_use_case_fk',
    'FOREIGN KEY (use_case_id) REFERENCES hr_ai.hr_ai_use_cases(id) ON DELETE CASCADE',
  );
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_ai', name: 'hr_ai_kill_switches' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_ai', name: 'hr_ai_model_runs' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_ai', name: 'hr_ai_bias_tests' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_ai', name: 'hr_ai_use_cases' }, { cascade: true });
};
