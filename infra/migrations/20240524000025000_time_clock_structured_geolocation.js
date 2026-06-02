exports.up = (pgm) => {
  pgm.addColumns({ schema: 'hr_time', name: 'time_clock_events' }, {
    latitude: { type: 'numeric' },
    longitude: { type: 'numeric' },
    accuracy_meters: { type: 'numeric' },
    workplace_code: { type: 'text' },
    distance_meters: { type: 'numeric' },
    geofence_radius_meters: { type: 'numeric' },
    geofence_profile_code: { type: 'text' },
    location_status: { type: 'text' },
    device_trust_level: { type: 'text' },
    trust_level: { type: 'text' },
    trust_score: { type: 'numeric' },
    trust_requires_approval: { type: 'boolean' },
    trust_reasons: { type: 'jsonb' },
  });
  pgm.createIndex({ schema: 'hr_time', name: 'time_clock_events' }, ['tenant_id', 'workplace_code', 'timestamp']);
  pgm.createIndex({ schema: 'hr_time', name: 'time_clock_events' }, ['tenant_id', 'location_status']);
};

exports.down = (pgm) => {
  pgm.dropIndex({ schema: 'hr_time', name: 'time_clock_events' }, ['tenant_id', 'location_status'], { ifExists: true });
  pgm.dropIndex({ schema: 'hr_time', name: 'time_clock_events' }, ['tenant_id', 'workplace_code', 'timestamp'], { ifExists: true });
  pgm.dropColumns({ schema: 'hr_time', name: 'time_clock_events' }, [
    'latitude',
    'longitude',
    'accuracy_meters',
    'workplace_code',
    'distance_meters',
    'geofence_radius_meters',
    'geofence_profile_code',
    'location_status',
    'device_trust_level',
    'trust_level',
    'trust_score',
    'trust_requires_approval',
    'trust_reasons',
  ]);
};
