exports.up = (pgm) => {
  const table = { schema: 'hr_platform', name: 'admin_policy_revision_scopes' };
  pgm.addColumns(table, {
    branch_codes: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    job_codes: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    grade_codes: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    manager_worker_ids: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
  });
};

exports.down = (pgm) => {
  const table = { schema: 'hr_platform', name: 'admin_policy_revision_scopes' };
  pgm.dropColumns(table, ['branch_codes', 'job_codes', 'grade_codes', 'manager_worker_ids']);
};
