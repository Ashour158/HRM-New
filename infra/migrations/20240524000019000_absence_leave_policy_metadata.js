exports.up = (pgm) => {
  pgm.addColumns({ schema: 'hr_absence', name: 'absence_requests' }, {
    policy_code: { type: 'text' },
    duration_unit: { type: 'text', notNull: true, default: 'DAYS' },
    duration_amount: { type: 'numeric', notNull: true, default: 0 },
    start_time: { type: 'text' },
    end_time: { type: 'text' },
    paid: { type: 'boolean', notNull: true, default: true },
    deduct_from_balance: { type: 'boolean', notNull: true, default: true },
    payroll_impact: { type: 'text', notNull: true, default: 'PAID_LEAVE' },
    calendar_days: { type: 'integer', notNull: true, default: 0 },
    working_days: { type: 'numeric', notNull: true, default: 0 },
    excluded_holiday_dates: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
  });
  pgm.createIndex({ schema: 'hr_absence', name: 'absence_requests' }, ['tenant_id', 'policy_code']);
};

exports.down = (pgm) => {
  pgm.dropIndex({ schema: 'hr_absence', name: 'absence_requests' }, ['tenant_id', 'policy_code'], { ifExists: true });
  pgm.dropColumns({ schema: 'hr_absence', name: 'absence_requests' }, [
    'excluded_holiday_dates',
    'working_days',
    'calendar_days',
    'payroll_impact',
    'deduct_from_balance',
    'paid',
    'end_time',
    'start_time',
    'duration_amount',
    'duration_unit',
    'policy_code',
  ]);
};
