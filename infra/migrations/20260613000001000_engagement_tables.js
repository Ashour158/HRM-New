exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_engagement', name: 'engagement_surveys' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    title: { type: 'text', notNull: true },
    survey_type: { type: 'text', notNull: true },
    questions: { type: 'jsonb', notNull: true, default: '[]' },
    anonymous: { type: 'boolean', notNull: true, default: false },
    start_date: { type: 'timestamptz' },
    end_date: { type: 'timestamptz' },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_engagement', name: 'engagement_surveys' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_engagement', name: 'engagement_surveys' }, ['tenant_id', 'survey_type']);

  pgm.createTable({ schema: 'hr_engagement', name: 'survey_responses' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    survey_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    responses: { type: 'jsonb', notNull: true, default: '{}' },
    submitted_at: { type: 'timestamptz' },
    is_anonymous: { type: 'boolean', notNull: true, default: false },
    status: { type: 'text', notNull: true, default: 'STARTED' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_engagement', name: 'survey_responses' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_engagement', name: 'survey_responses' }, ['tenant_id', 'survey_id']);
  pgm.createIndex({ schema: 'hr_engagement', name: 'survey_responses' }, ['tenant_id', 'worker_id']);
  pgm.addConstraint(
    { schema: 'hr_engagement', name: 'survey_responses' },
    'survey_responses_survey_fk',
    'FOREIGN KEY (survey_id) REFERENCES hr_engagement.engagement_surveys(id) ON DELETE CASCADE',
  );

  pgm.createTable({ schema: 'hr_engagement', name: 'recognition_programs' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    program_name: { type: 'text', notNull: true },
    program_type: { type: 'text', notNull: true },
    budget: { type: 'numeric' },
    currency: { type: 'text' },
    status: { type: 'text', notNull: true, default: 'ACTIVE' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_engagement', name: 'recognition_programs' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_engagement', name: 'recognition_programs' }, ['tenant_id', 'program_type']);

  pgm.createTable({ schema: 'hr_engagement', name: 'recognition_records' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    from_worker_id: { type: 'uuid', notNull: true },
    to_worker_id: { type: 'uuid', notNull: true },
    program_id: { type: 'uuid', notNull: true },
    points: { type: 'numeric' },
    message: { type: 'text' },
    approved_by: { type: 'uuid' },
    status: { type: 'text', notNull: true, default: 'SUBMITTED' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_engagement', name: 'recognition_records' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_engagement', name: 'recognition_records' }, ['tenant_id', 'to_worker_id']);
  pgm.createIndex({ schema: 'hr_engagement', name: 'recognition_records' }, ['tenant_id', 'program_id']);
  pgm.addConstraint(
    { schema: 'hr_engagement', name: 'recognition_records' },
    'recognition_records_program_fk',
    'FOREIGN KEY (program_id) REFERENCES hr_engagement.recognition_programs(id) ON DELETE CASCADE',
  );
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_engagement', name: 'recognition_records' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_engagement', name: 'recognition_programs' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_engagement', name: 'survey_responses' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_engagement', name: 'engagement_surveys' }, { cascade: true });
};
