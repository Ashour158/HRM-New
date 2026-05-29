exports.up = (pgm) => {
  pgm.addColumn({ schema: 'hr_core', name: 'personal_data_records' }, {
    state: { type: 'text', notNull: true, default: 'DRAFT' },
  });
  pgm.addConstraint(
    { schema: 'hr_core', name: 'personal_data_records' },
    'personal_data_records_state_check',
    "CHECK (state IN ('DRAFT', 'ACTIVE', 'SUPPRESSED', 'DELETED'))",
  );
};

exports.down = (pgm) => {
  pgm.dropConstraint({ schema: 'hr_core', name: 'personal_data_records' }, 'personal_data_records_state_check');
  pgm.dropColumn({ schema: 'hr_core', name: 'personal_data_records' }, 'state');
};
