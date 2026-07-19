/**
 * Severity-driven escalation engine: disciplinary actions above the configured
 * legal-review severity threshold must have a recorded legal review before the
 * ExecuteDisciplinaryAction (finalize) command is allowed to proceed. These
 * columns track that "LegalReviewCompleted"-style acknowledgement. Additive-only,
 * same pattern as 20260714000001000_country_policy_review_gate_tracking.
 */
exports.up = (pgm) => {
  pgm.addColumn(
    { schema: 'hr_er', name: 'disciplinary_actions' },
    {
      legal_review_completed_at: { type: 'timestamptz' },
      legal_review_completed_by: { type: 'uuid' },
    },
  );
};

exports.down = (pgm) => {
  pgm.dropColumn({ schema: 'hr_er', name: 'disciplinary_actions' }, [
    'legal_review_completed_at',
    'legal_review_completed_by',
  ]);
};
