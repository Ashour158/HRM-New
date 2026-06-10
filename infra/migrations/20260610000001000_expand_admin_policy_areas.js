const TABLE = { schema: 'hr_platform', name: 'admin_policy_revisions' };
const CONSTRAINT = 'admin_policy_revisions_area_check';

exports.up = (pgm) => {
  pgm.dropConstraint(TABLE, CONSTRAINT, { ifExists: true });
  pgm.addConstraint(
    TABLE,
    CONSTRAINT,
    "CHECK (area IN ('EMPLOYEE_SETUP', 'LEAVE', 'ATTENDANCE', 'PAYROLL', 'ACCESS_GOVERNANCE', 'COUNTRY_POLICY', 'COMPLIANCE', 'BENEFITS', 'GLOBAL_HR', 'DEI_ANALYTICS', 'ENGAGEMENT'))",
  );
};

exports.down = (pgm) => {
  pgm.dropConstraint(TABLE, CONSTRAINT, { ifExists: true });
  pgm.addConstraint(
    TABLE,
    CONSTRAINT,
    "CHECK (area IN ('EMPLOYEE_SETUP', 'LEAVE', 'ATTENDANCE', 'PAYROLL', 'ACCESS_GOVERNANCE', 'COUNTRY_POLICY', 'COMPLIANCE'))",
  );
};
