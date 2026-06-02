exports.up = (pgm) => {
  pgm.addColumns({ schema: 'hr_position', name: 'headcount_requests' }, {
    approved_at: { type: 'timestamptz' },
    positions_requested: { type: 'integer', notNull: true, default: 1 },
    positions_approved: { type: 'integer' },
    auto_create_position: { type: 'boolean', notNull: true, default: false },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns({ schema: 'hr_position', name: 'headcount_requests' }, [
    'auto_create_position',
    'positions_approved',
    'positions_requested',
    'approved_at',
  ]);
};
