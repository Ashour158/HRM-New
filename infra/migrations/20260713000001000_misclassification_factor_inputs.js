/**
 * Misclassification assessments previously stored riskScore/riskFactors as
 * raw caller-supplied values with no underlying evidence. The scoring engine
 * now computes riskScore/riskFactors from a structured set of IRS
 * common-law-test factor inputs (behavioral control, financial control,
 * relationship type). Add the column that persists those factor inputs so
 * the score can be recalculated later as evidence changes.
 */
exports.up = (pgm) => {
  pgm.addColumn({ schema: 'hr_contingent', name: 'misclassification_assessments' }, {
    factor_inputs: { type: 'jsonb' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn({ schema: 'hr_contingent', name: 'misclassification_assessments' }, 'factor_inputs');
};
