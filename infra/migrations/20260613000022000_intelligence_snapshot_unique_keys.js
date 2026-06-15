exports.up = (pgm) => {
  pgm.createIndex(
    { schema: 'hr_intelligence', name: 'attrition_risk_snapshots' },
    ['tenant_id', 'worker_id', 'period_key', 'model_key'],
    { unique: true, name: 'attrition_risk_snapshots_natural_key_uidx' },
  );
  pgm.createIndex(
    { schema: 'hr_intelligence', name: 'attendance_payroll_anomaly_snapshots' },
    ['tenant_id', 'worker_id', 'period_key', 'model_key', 'anomaly_type'],
    { unique: true, name: 'attendance_payroll_anomaly_snapshots_natural_key_uidx' },
  );
};

exports.down = (pgm) => {
  pgm.dropIndex(
    { schema: 'hr_intelligence', name: 'attendance_payroll_anomaly_snapshots' },
    ['tenant_id', 'worker_id', 'period_key', 'model_key', 'anomaly_type'],
    { name: 'attendance_payroll_anomaly_snapshots_natural_key_uidx' },
  );
  pgm.dropIndex(
    { schema: 'hr_intelligence', name: 'attrition_risk_snapshots' },
    ['tenant_id', 'worker_id', 'period_key', 'model_key'],
    { name: 'attrition_risk_snapshots_natural_key_uidx' },
  );
};
