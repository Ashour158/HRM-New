exports.up = (pgm) => {
  pgm.sql('ALTER TABLE hr_er.employee_relations_cases ADD COLUMN IF NOT EXISTS opened_by uuid');
  pgm.sql('UPDATE hr_er.employee_relations_cases SET opened_by = subject_worker_id WHERE opened_by IS NULL');
  pgm.sql('ALTER TABLE hr_er.employee_relations_cases ALTER COLUMN opened_by SET NOT NULL');
  pgm.createIndex({ schema: 'hr_er', name: 'employee_relations_cases' }, ['tenant_id', 'opened_by'], {
    name: 'employee_relations_cases_tenant_opened_by_idx',
    ifNotExists: true,
  });
};

exports.down = (pgm) => {
  pgm.dropIndex({ schema: 'hr_er', name: 'employee_relations_cases' }, ['tenant_id', 'opened_by'], {
    name: 'employee_relations_cases_tenant_opened_by_idx',
    ifExists: true,
  });
  pgm.sql('ALTER TABLE hr_er.employee_relations_cases DROP COLUMN IF EXISTS opened_by');
};
