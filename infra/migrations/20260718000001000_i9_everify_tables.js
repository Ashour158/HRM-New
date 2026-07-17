/**
 * I-9 / E-Verify domain: adds `hr_i9_everify.i9_forms` (Form I-9 Section 1/2
 * tracking) and `hr_i9_everify.everify_cases` (federal E-Verify submission
 * sub-lifecycle), matching the `i9-everify` policy engine's registered table
 * names (`packages/hr-policy-engines/src/engines/registered-engines.ts`).
 */
exports.up = (pgm) => {
  pgm.createSchema('hr_i9_everify', { ifNotExists: true });

  pgm.createTable({ schema: 'hr_i9_everify', name: 'i9_forms' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    start_date: { type: 'date', notNull: true },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    citizenship_status: { type: 'text' },
    section1_completed_at: { type: 'timestamptz' },
    section1_late: { type: 'boolean', notNull: true, default: false },
    document_type: { type: 'text' },
    document_descriptions: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    document_expiration_date: { type: 'date' },
    reviewer_id: { type: 'uuid' },
    section2_due_date: { type: 'date', notNull: true },
    section2_completed_at: { type: 'timestamptz' },
    section2_late: { type: 'boolean', notNull: true, default: false },
    everify_case_id: { type: 'uuid' },
    rejection_reason: { type: 'text' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_i9_everify', name: 'i9_forms' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_i9_everify', name: 'i9_forms' }, ['tenant_id', 'worker_id']);
  pgm.createIndex({ schema: 'hr_i9_everify', name: 'i9_forms' }, ['tenant_id', 'section2_due_date']);

  pgm.createTable({ schema: 'hr_i9_everify', name: 'everify_cases' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    i9_case_id: { type: 'uuid', notNull: true },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    case_number: { type: 'text' },
    submitted_at: { type: 'timestamptz' },
    simulated_determination: { type: 'text' },
    result: { type: 'text' },
    result_recorded_at: { type: 'timestamptz' },
    result_recorded_by: { type: 'uuid' },
    contested_at: { type: 'timestamptz' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_i9_everify', name: 'everify_cases' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_i9_everify', name: 'everify_cases' }, ['tenant_id', 'worker_id']);
  pgm.createIndex({ schema: 'hr_i9_everify', name: 'everify_cases' }, ['tenant_id', 'i9_case_id']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_i9_everify', name: 'everify_cases' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_i9_everify', name: 'i9_forms' }, { cascade: true });
};
