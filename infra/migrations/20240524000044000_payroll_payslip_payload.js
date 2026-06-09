exports.up = (pgm) => {
  pgm.addColumns({ schema: 'hr_payroll', name: 'payroll_payslip_artifacts' }, {
    payslip_payload: { type: 'jsonb', notNull: true, default: '{}' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns({ schema: 'hr_payroll', name: 'payroll_payslip_artifacts' }, ['payslip_payload']);
};
