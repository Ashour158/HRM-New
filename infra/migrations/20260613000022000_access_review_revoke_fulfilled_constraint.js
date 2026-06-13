const TABLE = { schema: 'hr_platform', name: 'access_review_workflow_events' };
const CONSTRAINT = 'access_review_workflow_events_type_check';

exports.up = (pgm) => {
  pgm.dropConstraint(TABLE, CONSTRAINT, { ifExists: true });
  pgm.addConstraint(
    TABLE,
    CONSTRAINT,
    "CHECK (event_type IN ('LAUNCHED', 'REMINDER_SENT', 'ESCALATED', 'COMPLETED', 'REVOKE_FULFILLED'))",
  );
};

exports.down = (pgm) => {
  pgm.dropConstraint(TABLE, CONSTRAINT, { ifExists: true });
  pgm.addConstraint(
    TABLE,
    CONSTRAINT,
    "CHECK (event_type IN ('LAUNCHED', 'REMINDER_SENT', 'ESCALATED', 'COMPLETED'))",
  );
};
