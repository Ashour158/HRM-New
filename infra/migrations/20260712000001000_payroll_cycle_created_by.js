/**
 * HCM-P0-5b: the payroll "preparer cannot approve" SoD control had nothing to
 * compare the approving actor against -- payroll_cycles never recorded who
 * created it. Add created_by (nullable so existing rows are unaffected) so
 * PayrollCycle.approve() can reject an approver who is also the preparer.
 */
exports.up = (pgm) => {
  pgm.addColumn(
    { schema: 'hr_payroll', name: 'payroll_cycles' },
    { created_by: { type: 'uuid' } },
  );
};

exports.down = (pgm) => {
  pgm.dropColumn({ schema: 'hr_payroll', name: 'payroll_cycles' }, 'created_by');
};
