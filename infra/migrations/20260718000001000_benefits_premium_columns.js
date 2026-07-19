/**
 * Tier-0 payroll defect fix: BenefitsEnrollmentEffective / LifeEventProcessed
 * feed the payroll-input-builder-saga, which creates a BENEFITS_DEDUCTION
 * PayrollInput -- but BenefitsEnrollment had no premium/cost field at all, so
 * the saga always created a $0 deduction line.
 *
 * The premium rate is owned by the BenefitsProgram (the plan being enrolled
 * into) and snapshotted onto the BenefitsEnrollment at creation time, so the
 * dollar amount an employee is charged stays stable even if the program's
 * rate changes later. Additive-only.
 */
exports.up = (pgm) => {
  pgm.addColumn(
    { schema: 'hr_benefits', name: 'benefits_programs' },
    {
      monthly_premium: { type: 'numeric', notNull: true, default: 0 },
      currency: { type: 'char(3)', notNull: true, default: 'USD' },
    },
  );

  pgm.addColumn(
    { schema: 'hr_benefits', name: 'benefits_enrollments' },
    {
      premium_amount: { type: 'numeric', notNull: true, default: 0 },
      currency: { type: 'char(3)', notNull: true, default: 'USD' },
    },
  );
};

exports.down = (pgm) => {
  pgm.dropColumn({ schema: 'hr_benefits', name: 'benefits_enrollments' }, ['premium_amount', 'currency']);
  pgm.dropColumn({ schema: 'hr_benefits', name: 'benefits_programs' }, ['monthly_premium', 'currency']);
};
