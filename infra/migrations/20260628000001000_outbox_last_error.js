/**
 * Persist the last publish error on outbox_events so operators can diagnose WHY an
 * event exhausted its attempts (the dead-letter ops surface already lists exhausted
 * rows, but the failure reason was only logged, never stored).
 */
exports.up = (pgm) => {
  pgm.addColumn(
    { schema: 'hr_platform', name: 'outbox_events' },
    { last_error: { type: 'text' } },
  );
};

exports.down = (pgm) => {
  pgm.dropColumn({ schema: 'hr_platform', name: 'outbox_events' }, 'last_error');
};
