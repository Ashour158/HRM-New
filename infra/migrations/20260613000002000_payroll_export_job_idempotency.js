exports.up = (pgm) => {
  pgm.addConstraint(
    { schema: 'hr_payroll', name: 'payroll_export_jobs' },
    'payroll_export_jobs_cycle_type_purpose_hash_unique',
    {
      unique: ['tenant_id', 'payroll_cycle_id', 'export_type', 'purpose', 'file_hash'],
    },
  );
};

exports.down = (pgm) => {
  pgm.dropConstraint(
    { schema: 'hr_payroll', name: 'payroll_export_jobs' },
    'payroll_export_jobs_cycle_type_purpose_hash_unique',
    { ifExists: true },
  );
};
