exports.up = (pgm) => {
  pgm.addColumns({ schema: 'hr_time', name: 'time_clock_events' }, {
    capture_method: { type: 'text' },
    capture_device_kind: { type: 'text' },
    capture_reference: { type: 'text' },
    verification_status: { type: 'text' },
    capture_evidence: { type: 'jsonb', notNull: true, default: '{}' },
  });
  pgm.createIndex({ schema: 'hr_time', name: 'time_clock_events' }, ['tenant_id', 'capture_method']);
  pgm.createIndex({ schema: 'hr_time', name: 'time_clock_events' }, ['tenant_id', 'verification_status']);
};

exports.down = (pgm) => {
  pgm.dropIndex({ schema: 'hr_time', name: 'time_clock_events' }, ['tenant_id', 'verification_status'], { ifExists: true });
  pgm.dropIndex({ schema: 'hr_time', name: 'time_clock_events' }, ['tenant_id', 'capture_method'], { ifExists: true });
  pgm.dropColumns({ schema: 'hr_time', name: 'time_clock_events' }, [
    'capture_method',
    'capture_device_kind',
    'capture_reference',
    'verification_status',
    'capture_evidence',
  ]);
};
