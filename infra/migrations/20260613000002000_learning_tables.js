exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_learning', name: 'learning_courses' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    title: { type: 'text', notNull: true },
    description: { type: 'text' },
    content_type: { type: 'text', notNull: true },
    duration_minutes: { type: 'integer' },
    credits: { type: 'numeric' },
    certification_eligible: { type: 'boolean', notNull: true, default: false },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_learning', name: 'learning_courses' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_learning', name: 'learning_courses' }, ['tenant_id', 'content_type']);

  pgm.createTable({ schema: 'hr_learning', name: 'learning_assignments' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    course_id: { type: 'uuid', notNull: true },
    assigned_by: { type: 'uuid', notNull: true },
    assigned_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    due_date: { type: 'timestamptz' },
    completed_at: { type: 'timestamptz' },
    score: { type: 'numeric' },
    status: { type: 'text', notNull: true, default: 'ASSIGNED' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_learning', name: 'learning_assignments' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_learning', name: 'learning_assignments' }, ['tenant_id', 'worker_id']);
  pgm.createIndex({ schema: 'hr_learning', name: 'learning_assignments' }, ['tenant_id', 'course_id']);
  pgm.addConstraint(
    { schema: 'hr_learning', name: 'learning_assignments' },
    'learning_assignments_course_fk',
    'FOREIGN KEY (course_id) REFERENCES hr_learning.learning_courses(id) ON DELETE CASCADE',
  );

  pgm.createTable({ schema: 'hr_learning', name: 'learning_content_packages' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    package_type: { type: 'text', notNull: true },
    title: { type: 'text', notNull: true },
    version: { type: 'text' },
    file_url: { type: 'text' },
    manifest: { type: 'jsonb' },
    status: { type: 'text', notNull: true, default: 'UPLOADED' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_learning', name: 'learning_content_packages' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_learning', name: 'learning_content_packages' }, ['tenant_id', 'package_type']);

  pgm.createTable({ schema: 'hr_learning', name: 'certifications' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    certification_name: { type: 'text', notNull: true },
    issuing_body: { type: 'text' },
    issue_date: { type: 'timestamptz' },
    expiry_date: { type: 'timestamptz' },
    renewal_date: { type: 'timestamptz' },
    credential_id: { type: 'text' },
    status: { type: 'text', notNull: true, default: 'ACTIVE' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_learning', name: 'certifications' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_learning', name: 'certifications' }, ['tenant_id', 'worker_id']);
  pgm.createIndex({ schema: 'hr_learning', name: 'certifications' }, ['tenant_id', 'credential_id']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_learning', name: 'certifications' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_learning', name: 'learning_content_packages' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_learning', name: 'learning_assignments' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_learning', name: 'learning_courses' }, { cascade: true });
};
