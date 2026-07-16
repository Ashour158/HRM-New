/**
 * Country policy review-gate wiring: the CountryPolicyPack aggregate now
 * tracks which of `requiredApprovals` have actually been completed
 * (`completed_reviews`), and captures who rejected a pack and why
 * (`rejected_by`, `rejected_at`, `rejection_reason`). Additive-only.
 */
exports.up = (pgm) => {
  pgm.addColumn(
    { schema: 'hr_country_policy', name: 'policy_packs' },
    {
      completed_reviews: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
      rejected_by: { type: 'uuid' },
      rejected_at: { type: 'timestamptz' },
      rejection_reason: { type: 'text' },
    },
  );
};

exports.down = (pgm) => {
  pgm.dropColumn({ schema: 'hr_country_policy', name: 'policy_packs' }, [
    'completed_reviews',
    'rejected_by',
    'rejected_at',
    'rejection_reason',
  ]);
};
