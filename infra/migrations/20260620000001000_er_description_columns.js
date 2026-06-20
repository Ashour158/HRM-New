/**
 * Adds the missing `description` free-text columns to employee-relations
 * disciplinary actions and accommodation cases. Previously the aggregates
 * carried a `description` that was silently dropped on persist and hardcoded
 * to '' on read (data-loss bug). These columns hold sensitive personal data and
 * are encrypted at rest by the application layer (PII field encryption).
 */
exports.up = (pgm) => {
  pgm.addColumn({ schema: 'hr_er', name: 'disciplinary_actions' }, {
    description: { type: 'text' },
  });
  pgm.addColumn({ schema: 'hr_er', name: 'accommodation_cases' }, {
    description: { type: 'text' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn({ schema: 'hr_er', name: 'accommodation_cases' }, 'description');
  pgm.dropColumn({ schema: 'hr_er', name: 'disciplinary_actions' }, 'description');
};
